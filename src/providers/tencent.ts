import { BaseProvider } from './base';
import {
  TencentApiGatewayEvent,
  TencentScfContext,
  TencentScfResponse,
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
} from '../types';

export class TencentProvider extends BaseProvider {
  readonly name = 'tencent' as const;

  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent {
    const tencentEvent = JSON.parse(
      Buffer.from(rawEvent as Buffer).toString(),
    ) as TencentApiGatewayEvent;

    return {
      path: tencentEvent.path,
      httpMethod: tencentEvent.httpMethod,
      headers: tencentEvent.headers || {},
      queryParameters: tencentEvent.queryStringParameters || {},
      pathParameters: tencentEvent.pathParameters || {},
      body: tencentEvent.body,
      isBase64Encoded: false,
    };
  }

  formatResponse(response: ServerlessResponse): TencentScfResponse {
    return {
      isBase64Encoded: response.isBase64Encoded,
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    };
  }

  detect(_rawEvent: ProviderEvent, rawContext: ProviderContext): boolean {
    const context = rawContext as TencentScfContext;
    return !!(context.tencentcloud_region || context.tencentcloud_appid || context.namespace);
  }
}
