import { BaseProvider } from './base';
import {
  VolcengineApiGatewayEvent,
  VolcengineVefaasContext,
  VolcengineVefaasResponse,
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
} from '../types';

export class VolcengineProvider extends BaseProvider {
  readonly name = 'volcengine' as const;

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
