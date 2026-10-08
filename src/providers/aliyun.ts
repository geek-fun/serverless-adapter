import { BaseProvider } from './base';
import {
  AliyunApiGatewayContext,
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
  AliyunResponse,
  EventClassification,
} from '../types';

export class AliyunProvider extends BaseProvider {
  readonly name = 'aliyun' as const;

  /**
   * Function Compute delivers every trigger type to the same handler as a
   * different event shape, so the shape is the only thing telling an API Gateway
   * request apart from a time trigger (a `{triggerTime, triggerName, payload}`
   * event — the docs list it under "Time triggers").
   *
   * @see https://www.alibabacloud.com/help/en/functioncompute/formats-of-event-for-different-triggers-1
   */
  classifyEvent(rawEvent: ProviderEvent): EventClassification {
    const raw = this.parseEventPayload(rawEvent);
    if (!raw) {
      return { kind: 'unknown' };
    }

    if (this.looksLikeHttpEvent(raw)) {
      return { kind: 'http' };
    }

    if (typeof raw.triggerName === 'string') {
      return { kind: 'timer', detail: raw.triggerName };
    }

    return { kind: 'unknown' };
  }

  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent {
    let raw: Record<string, unknown>;
    if (Buffer.isBuffer(rawEvent)) {
      raw = JSON.parse(rawEvent.toString());
    } else if (typeof rawEvent === 'string') {
      raw = JSON.parse(rawEvent);
    } else {
      raw = rawEvent as unknown as Record<string, unknown>;
    }
    return {
      path: (raw.path as string) || '/',
      httpMethod: (raw.httpMethod as string) || 'GET',
      headers: (raw.headers as Record<string, string>) || {},
      queryParameters: (raw.queryParameters as Record<string, string>) || {},
      pathParameters: (raw.pathParameters as Record<string, string>) || {},
      body: raw.body,
      isBase64Encoded: (raw.isBase64Encoded as boolean) || false,
    };
  }

  formatResponse(response: ServerlessResponse): AliyunResponse {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
      isBase64Encoded: response.isBase64Encoded,
      multiValueHeaders: (response as Record<string, unknown>).multiValueHeaders as
        | { [key: string]: string[] }
        | undefined,
    };
  }

  detect(_rawEvent: ProviderEvent, rawContext: ProviderContext): boolean {
    const context = rawContext as AliyunApiGatewayContext;

    if (context.service?.name || context.tracing || context.logger) {
      return true;
    }

    if (context.credentials && context.function?.memory !== undefined) {
      return true;
    }

    return false;
  }
}
