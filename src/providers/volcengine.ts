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

export class VolcengineProvider extends BaseProvider {
  readonly name = 'volcengine' as const;

  /**
   * veFaaS API Gateway events are positively identifiable (`path` + `method`).
   *
   * Timer invocations are recognized by the positive `Type: 'Timer'` marker of
   * the Tencent-style envelope that serverlessinsight generates for veFaaS
   * timers (that marker lives in `normalizeTimerEvent`); the real platform
   * envelope is not verified yet, so anything else is reported as `unknown`
   * rather than guessed into the HTTP path (issue #23).
   */
  classifyEvent(rawEvent: ProviderEvent): EventClassification {
    const raw = this.parseEventPayload(rawEvent);
    if (!raw) {
      return { kind: 'unknown' };
    }

    if (typeof raw.path === 'string' && typeof raw.method === 'string') {
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
   * The Tencent-style timer envelope si assumes for veFaaS (issue #23).
   */
  normalizeTimerEvent(rawEvent: ProviderEvent): TimerEvent | null {
    return this.normalizeTypeTimerEvent(rawEvent);
  }

  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent {
    const volcengineEvent = JSON.parse(
      Buffer.from(rawEvent as Buffer).toString(),
    ) as VolcengineApiGatewayEvent;

    return {
      path: volcengineEvent.path,
      httpMethod: volcengineEvent.method,
      headers: volcengineEvent.headers || {},
      queryParameters: volcengineEvent.query || {},
      pathParameters: {},
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
