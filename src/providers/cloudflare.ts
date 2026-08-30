import { BaseProvider } from './base';
import {
  CloudflareResponse,
  CloudflareWorkerContext,
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
} from '../types';

/**
 * Cloudflare Workers dispatches fetch(Request, ExecutionContext) — the raw web
 * standard Request is the event and ExecutionContext exposes waitUntil.
 * @see https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/
 */
export class CloudflareProvider extends BaseProvider {
  readonly name = 'cloudflare' as const;

  async normalizeEvent(rawEvent: ProviderEvent): Promise<ServerlessEvent> {
    const request = rawEvent as unknown as Request;
    const url = new URL(request.url);

    // GET/HEAD requests must not carry a body per the fetch spec
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

    return {
      path: url.pathname,
      httpMethod: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      queryParameters: Object.fromEntries(url.searchParams.entries()),
      pathParameters: {},
      body,
      isBase64Encoded: false,
    };
  }

  formatResponse(response: ServerlessResponse): CloudflareResponse {
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

  detect(rawEvent: ProviderEvent, rawContext: ProviderContext): boolean {
    if (typeof Request === 'undefined' || !(rawEvent instanceof Request)) {
      return false;
    }

    const context = rawContext as CloudflareWorkerContext;
    return typeof context?.waitUntil === 'function';
  }
}
