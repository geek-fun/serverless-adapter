import { Express } from 'express';
import Application from 'koa';
import { IncomingHttpHeaders } from 'http';
import { constructFramework } from './framework';
import { waitForStreamComplete, buildResponse } from './transport';
import { detectProvider, getProvider } from './providers';
import { debug } from './common';
import { UnsupportedEventError, eventKeysOf } from './errors';
import {
  CloudProvider,
  HonoApp,
  ProviderEvent,
  ProviderContext,
  ServerlessResponse,
} from './types';

export interface ServerlessAdapterOptions {
  provider?: CloudProvider;
  /**
   * What to do with an invocation that is not an HTTP event (a timer trigger,
   * a queue event, …). Such an invocation has no request to build and no HTTP
   * response contract, so answering it with the web framework silently reports
   * success for work that never happened (issue #22).
   *
   * - `'error'` (default): throw an `UnsupportedEventError`, so FC / SCF / Lambda
   *   record a failed invocation — visible in logs and alerts, and retried by the
   *   platform's own retry policy.
   * - `'ignore'`: skip classification and dispatch anyway, i.e. the historical
   *   permissive behaviour. Deprecation escape hatch; prefer handling non-HTTP
   *   triggers in your own entrypoint.
   */
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

const serverlessAdapter = (
  app: Express | Application | HonoApp,
  options?: ServerlessAdapterOptions,
): Handler => {
  const serverlessFramework = constructFramework(app);

  return async (event: ProviderEvent, context: ProviderContext): Promise<HandlerResult> => {
    debug(`serverlessAdapter receive event: ${JSON.stringify({ event, context })}`);

    const provider = options?.provider
      ? getProvider(options.provider)
      : detectProvider(event, context);

    if (!provider) {
      throw new Error('Unable to detect cloud provider. Please specify provider option.');
    }

    debug(`serverlessAdapter: Using provider: ${provider.name}`);

    // Classification runs BEFORE the try/catch below on purpose: that catch turns
    // errors into a 500 *response*, which a non-HTTP invocation would happily
    // report as a success. An unhandled invocation has to throw to be visible.
    if (options?.onUnhandledEvent !== 'ignore') {
      const classification = provider.classifyEvent?.(event) ?? { kind: 'http' as const };

      if (classification.kind !== 'http') {
        throw new UnsupportedEventError({
          provider: provider.name,
          kind: classification.kind,
          ...(classification.detail ? { detail: classification.detail } : {}),
          eventKeys: eventKeysOf(event),
        });
      }
    } else {
      debug(`serverlessAdapter: onUnhandledEvent is 'ignore' — skipping event classification`);
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
};

export default serverlessAdapter;

export * from './types';
export * from './providers';
export * from './errors';
