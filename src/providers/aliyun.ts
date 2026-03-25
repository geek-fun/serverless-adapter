import { BaseProvider } from './base';
import {
  AliyunApiGatewayContext,
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
  AliyunResponse,
} from '../types';

export class AliyunProvider extends BaseProvider {
  readonly name = 'aliyun' as const;

  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent {
    const event = JSON.parse(Buffer.from(rawEvent as Buffer).toString());
    return {
      path: event.path,
      httpMethod: event.httpMethod,
      headers: event.headers || {},
      queryParameters: event.queryParameters || {},
      pathParameters: event.pathParameters || {},
      body: event.body,
      isBase64Encoded: event.isBase64Encoded || false,
    };
  }

  formatResponse(response: ServerlessResponse): AliyunResponse {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
      isBase64Encoded: response.isBase64Encoded,
    };
  }

  detect(_rawEvent: ProviderEvent, rawContext: ProviderContext): boolean {
    const context = rawContext as AliyunApiGatewayContext;
    return !!(context.accountId || context.credentials || context.service || context.tracing);
  }
}
