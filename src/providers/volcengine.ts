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
} from '../types';

export class VolcengineProvider extends BaseProvider {
  readonly name = 'volcengine' as const;

  /**
   * veFaaS API Gateway events are positively identifiable (`path` + `method`).
   * The veFaaS timer envelope is not verified yet (see issue #23), so anything
   * else is reported as `unknown` rather than guessed into the HTTP path — the
   * invocation still fails loudly instead of being answered by the app.
   */
  classifyEvent(rawEvent: ProviderEvent): EventClassification {
    const raw = this.parseEventPayload(rawEvent);
    if (!raw) {
      return { kind: 'unknown' };
    }

    if (typeof raw.path === 'string' && typeof raw.method === 'string') {
      return { kind: 'http' };
    }

    return { kind: 'unknown' };
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
