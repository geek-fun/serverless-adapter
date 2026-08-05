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

/**
 * Discriminates the Function URL (函数 URL) event-function format from the legacy
 * API Gateway trigger format via negative exclusion: queryStringParameters and
 * requestContext are always present on legacy events and never on Function URL events.
 * `== null` tolerates tooling-injected `null` for absent fields.
 */
const isFunctionUrlEvent = (raw: Record<string, unknown>): boolean =>
  raw.queryStringParameters == null && raw.requestContext == null;

export class TencentProvider extends BaseProvider {
  readonly name = 'tencent' as const;

  /**
   * Invocation format detected in normalizeEvent and consumed in formatResponse.
   * Safe as instance state: Tencent SCF handles one invocation per instance at a time
   * (freeze/thaw; concurrency spawns separate instances), and the provider is resolved
   * per handler call (src/index.ts). The registry in src/providers/index.ts is a shared
   * singleton, but this flag is always overwritten before it is read within an invocation.
   */
  private isFunctionUrlInvocation = false;

  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent {
    const raw = JSON.parse(Buffer.from(rawEvent as Buffer).toString()) as Record<string, unknown>;

    if (isFunctionUrlEvent(raw)) {
      this.isFunctionUrlInvocation = true;
      return {
        path: (raw.path as string) ?? '/',
        httpMethod: raw.httpMethod as string,
        headers: (raw.headers as Record<string, string>) ?? {},
        queryParameters: (raw.queryString as Record<string, string>) ?? {},
        pathParameters: {},
        body: raw.body as string,
        isBase64Encoded: false,
      };
    }

    const tencentEvent = raw as unknown as TencentApiGatewayEvent;
    this.isFunctionUrlInvocation = false;
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
    if (this.isFunctionUrlInvocation) {
      // Function URL documents only { statusCode, headers, body } — isBase64Encoded
      // and multiValueHeaders are not part of the contract and must be stripped.
      return {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
      };
    }

    return {
      isBase64Encoded: response.isBase64Encoded,
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
      multiValueHeaders: (response as Record<string, unknown>).multiValueHeaders as
        | { [key: string]: string[] }
        | undefined,
    };
  }

  detect(_rawEvent: ProviderEvent, rawContext: ProviderContext): boolean {
    const context = rawContext as TencentScfContext;
    return !!(context.tencentcloud_region || context.tencentcloud_appid || context.namespace);
  }
}
