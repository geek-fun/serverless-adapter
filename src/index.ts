import { IncomingHttpHeaders } from 'http';
import { constructFramework } from './framework';
import { waitForStreamComplete, buildResponse } from './transport';
import { detectProvider, getProvider } from './providers';
import { debug } from './common';
import { UnsupportedEventError, eventKeysOf } from './errors';
import {
  CloudProvider,
  EventHandlers,
  EventHandlersWithHttp,
  FrameworkApp,
  ProviderEvent,
  ProviderContext,
  ServerlessResponse,
  TimerEvent,
} from './types';

export interface ServerlessAdapterOptions {
  provider?: CloudProvider;
  /**
   * Non-HTTP trigger handlers (issue #23) — the sibling of `provider`: one
   * deployment targets one cloud, so handlers are keyed by event kind, never by
   * provider. Omit to keep the HTTP-only behaviour.
   *
   * A handler's return value is passed through to the platform verbatim —
   * non-HTTP invocations have no HTTP response contract, so results are never
   * wrapped into a fake `statusCode`/`body`. An error thrown inside a handler
   * propagates, failing the invocation.
   */
  events?: EventHandlers;
  /**
   * What to do with a non-HTTP invocation that has no matching `events` handler
   * (a timer trigger with no `events.timer`, a queue event with no
   * `events.nonHttp`). Answering it with the web framework silently reports
   * success for work that never happened (issue #22).
   *
   * - `'error'` (default): throw an `UnsupportedEventError`, so FC / SCF / Lambda
   *   record a failed invocation — visible in logs and alerts, and retried by the
   *   platform's own retry policy.
   * - `'ignore'`: skip classification and dispatch anyway, i.e. the historical
   *   permissive behaviour. Deprecation escape hatch; prefer handling non-HTTP
   *   triggers in your own entrypoint. Explicit `events` handlers still win.
   */
  onUnhandledEvent?: 'error' | 'ignore';
}

/**
 * The symmetric entrypoint form for multi-trigger functions: the HTTP app is
 * declared inside `events`, next to the other handlers.
 *
 * `serverlessAdapter({ provider: 'aws', events: { http: app, timer: runJob } })`
 */
export interface ServerlessAdapterEventOptions {
  provider?: CloudProvider;
  /** Must include the HTTP app; `timer` / `nonHttp` are optional. */
  events: EventHandlersWithHttp;
  onUnhandledEvent?: 'error' | 'ignore';
}

type HandlerResult = {
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
  isBase64Encoded: boolean;
  multiValueHeaders?: { [key: string]: string[] };
};

type Handler = (event: ProviderEvent, context: ProviderContext) => Promise<HandlerResult>;

/**
 * An Express app is a function, Koa exposes `.callback`, Hono exposes `.fetch` —
 * an options object has none of those, which makes the first argument of
 * `serverlessAdapter` unambiguous to discriminate.
 */
const isFrameworkApp = (candidate: unknown): candidate is FrameworkApp => {
  if (typeof candidate === 'function') {
    return true;
  }

  if (candidate === null || typeof candidate !== 'object') {
    return false;
  }

  const app = candidate as { fetch?: unknown; callback?: unknown };
  return typeof app.fetch === 'function' || typeof app.callback === 'function';
};

const isEventOptions = (
  candidate: unknown,
): candidate is ServerlessAdapterEventOptions & { events: Partial<EventHandlersWithHttp> } => {
  return (
    !isFrameworkApp(candidate) &&
    candidate !== null &&
    typeof candidate === 'object' &&
    'events' in (candidate as Record<string, unknown>)
  );
};

function serverlessAdapter(app: FrameworkApp, options?: ServerlessAdapterOptions): Handler;
function serverlessAdapter(options: ServerlessAdapterEventOptions): Handler;
function serverlessAdapter(
  appOrOptions: FrameworkApp | ServerlessAdapterEventOptions,
  options?: ServerlessAdapterOptions,
): Handler {
  let app: FrameworkApp;
  let adapterOptions: ServerlessAdapterOptions;

  if (isFrameworkApp(appOrOptions)) {
    app = appOrOptions;
    adapterOptions = options ?? {};

    if (adapterOptions.events && 'http' in adapterOptions.events) {
      throw new Error(
        'serverlessAdapter received both a positional app and events.http. ' +
          'Pass the app positionally with { events: { timer, nonHttp } }, or use the ' +
          'symmetric form serverlessAdapter({ provider, events: { http, timer } }).',
      );
    }
  } else if (isEventOptions(appOrOptions) && isFrameworkApp(appOrOptions.events?.http)) {
    app = appOrOptions.events.http as FrameworkApp;
    adapterOptions = appOrOptions;
  } else {
    throw new Error(
      'serverlessAdapter expected a web framework app (Express, Koa or Hono) as first ' +
        'argument, or an options object whose events.http is such an app.',
    );
  }

  const events = adapterOptions.events;
  const serverlessFramework = constructFramework(app);

  return async (event: ProviderEvent, context: ProviderContext): Promise<HandlerResult> => {
    debug(`serverlessAdapter receive event: ${JSON.stringify({ event, context })}`);

    const provider = adapterOptions.provider
      ? getProvider(adapterOptions.provider)
      : detectProvider(event, context);

    if (!provider) {
      throw new Error('Unable to detect cloud provider. Please specify provider option.');
    }

    debug(`serverlessAdapter: Using provider: ${provider.name}`);

    // Classification runs BEFORE the try/catch below on purpose: that catch turns
    // errors into a 500 *response*, which a non-HTTP invocation would happily
    // report as a success. An unhandled invocation has to throw to be visible.
    const classification = provider.classifyEvent?.(event) ?? { kind: 'http' as const };

    if (classification.kind !== 'http') {
      // An explicit handler wins over every fallback policy (issue #23).
      if (classification.kind === 'timer' && events?.timer) {
        const timerEvent: TimerEvent = provider.normalizeTimerEvent?.(event) ?? {
          provider: provider.name,
          raw: event,
        };
        debug(`serverlessAdapter: dispatching timer "${timerEvent.triggerName}" to events.timer`);

        return (await events.timer(timerEvent, context)) as HandlerResult;
      }

      if (classification.kind === 'unknown' && events?.nonHttp) {
        debug(`serverlessAdapter: dispatching unrecognized invocation to events.nonHttp`);

        return (await events.nonHttp(event, context)) as HandlerResult;
      }

      if (adapterOptions.onUnhandledEvent !== 'ignore') {
        throw new UnsupportedEventError({
          provider: provider.name,
          kind: classification.kind,
          ...(classification.detail ? { detail: classification.detail } : {}),
          eventKeys: eventKeysOf(event),
        });
      }

      debug(
        `serverlessAdapter: onUnhandledEvent is 'ignore' — dispatching anyway (legacy behaviour)`,
      );
    }

    try {
      const normalizedEvent = await provider.normalizeEvent(event);
      const { request } = provider.createRequest(normalizedEvent);

      debug(`serverlessAdapter normalizedEvent: ${JSON.stringify(normalizedEvent)}`);

      const response = await serverlessFramework(request);
      await waitForStreamComplete(response);

      const builtResponse = buildResponse({ request, response });
      const formattedResponse = provider.formatResponse(
        builtResponse as ServerlessResponse,
      ) as HandlerResult;

      return formattedResponse;
    } catch (err) {
      return {
        statusCode: 500,
        body: (err as Error).message,
        headers: {},
        isBase64Encoded: false,
      };
    }
  };
}

export default serverlessAdapter;

export { isTimerEvent, normalizeTimerEvent } from './timer';
export * from './types';
export * from './providers';
export * from './errors';
