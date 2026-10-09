import { BaseProvider } from './base';
import {
  VolcengineApiGatewayEvent,
  VolcengineVefaasContext,
  VolcengineVefaasResponse,
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
  EventClassification,
  TimerEvent,
} from '../types';
import { decodeTimerPayload } from '../common';

/** CloudEvents `type` of a veFaaS Timer invocation (documented platform envelope). */
const VEFAAS_TIMER_EVENT_TYPE = 'faas.timer.event';

/**
 * `/faas/event/timer/{timer_id}` → `{timer_id}`.
 *
 * The Timer event carries no trigger *name* (a function can own up to 20
 * triggers), so the id from `source` is the only per-trigger discriminator the
 * platform gives us.
 */
const timerIdFromSource = (source: unknown): string | undefined => {
  if (typeof source !== 'string') {
    return undefined;
  }

  const segments = source.split('/').filter((segment) => segment.length > 0);
  return segments.length > 0 ? segments[segments.length - 1] : undefined;
};

export class VolcengineProvider extends BaseProvider {
  readonly name = 'volcengine' as const;

  /**
   * veFaaS API Gateway events are positively identifiable by `path` plus a
   * request method — documented as `httpMethod`, legacy deployments use `method`.
   *
   * Timer invocations are positively identified by their CloudEvents envelope
   * (`type: 'faas.timer.event'`); both live in `normalizeTimerEvent` (single
   * source of truth). Anything else — TOS / MQ / TLS triggers are CloudEvents
   * of other types — is reported as `unknown` rather than guessed into the HTTP
   * path.
   */
  classifyEvent(rawEvent: ProviderEvent): EventClassification {
    const raw = this.parseEventPayload(rawEvent);
    if (!raw) {
      return { kind: 'unknown' };
    }

    const requestMethod =
      typeof raw.httpMethod === 'string'
        ? raw.httpMethod
        : typeof raw.method === 'string'
          ? raw.method
          : undefined;

    if (typeof raw.path === 'string' && requestMethod !== undefined) {
      return { kind: 'http' };
    }

    const timer = this.normalizeTimerEvent(rawEvent);
    if (timer) {
      return timer.triggerName !== undefined
        ? { kind: 'timer', detail: timer.triggerName }
        : { kind: 'timer' };
    }

    return { kind: 'unknown' };
  }

  /**
   * The documented Timer envelope is CloudEvents:
   *
   * ```json
   * { "id": "…", "source": "/faas/event/timer/{timer_id}", "specversion": "1.0",
   *   "time": "2022-11-22T04:28:07Z", "type": "faas.timer.event",
   *   "datacontenttype": "application/octet-stream", "data": "Hello Volcengine" }
   * ```
   *
   * `serverlessinsight`'s local runner emits the SCF-style
   * `{Type: 'Timer', TriggerName, Time, Message}` envelope for veFaaS, which is
   * still accepted so `si local` keeps working.
   *
   * @see https://www.volcengine.com/docs/6662/116914
   */
  normalizeTimerEvent(rawEvent: ProviderEvent): TimerEvent | null {
    const raw = this.parseEventPayload(rawEvent);
    if (!raw) {
      return null;
    }

    if (raw.type === VEFAAS_TIMER_EVENT_TYPE) {
      const timerId = timerIdFromSource(raw.source);
      return {
        provider: this.name,
        ...(timerId !== undefined ? { triggerName: timerId } : {}),
        ...(typeof raw.time === 'string' ? { triggerTime: raw.time } : {}),
        ...(raw.data !== undefined ? { payload: decodeTimerPayload(raw.data) } : {}),
        raw: rawEvent,
      };
    }

    return this.normalizeTypeTimerEvent(rawEvent);
  }

  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent {
    const volcengineEvent = JSON.parse(
      Buffer.from(rawEvent as Buffer).toString(),
    ) as VolcengineApiGatewayEvent;

    return {
      path: volcengineEvent.path,
      // Documented field first, legacy spelling as the fallback.
      httpMethod: (volcengineEvent.httpMethod ?? volcengineEvent.method) as string,
      headers: volcengineEvent.headers || {},
      queryParameters: volcengineEvent.queryStringParameters ?? volcengineEvent.query ?? {},
      pathParameters: volcengineEvent.pathParameters ?? {},
      body: volcengineEvent.body,
      isBase64Encoded: false,
    };
  }

  formatResponse(response: ServerlessResponse): VolcengineVefaasResponse {
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
      multiValueHeaders: (response as Record<string, unknown>).multiValueHeaders as
        | { [key: string]: string[] }
        | undefined,
    };
  }

  detect(_rawEvent: ProviderEvent, rawContext: ProviderContext): boolean {
    const context = rawContext as VolcengineVefaasContext;
    const aliyunContext = rawContext as {
      service?: { name?: string };
      tracing?: unknown;
      logger?: unknown;
    };
    const hasAliyunSpecificFields = !!(
      aliyunContext.service?.name ||
      aliyunContext.tracing ||
      aliyunContext.logger
    );

    if (hasAliyunSpecificFields) {
      return false;
    }

    return !!(
      context.requestId &&
      context.region &&
      (context.accountId || context.credentials || context.function?.memoryMb)
    );
  }
}
