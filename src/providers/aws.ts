import { BaseProvider } from './base';
import {
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
  AwsResponse,
} from '../types';

/**
 * AWS Lambda + API Gateway Provider
 * Supports both REST API v1 and HTTP API v2 event formats
 */
export class AWSProvider extends BaseProvider {
  readonly name = 'aws' as const;

  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent {
    let raw: Record<string, unknown>;
    if (Buffer.isBuffer(rawEvent)) {
      raw = JSON.parse(rawEvent.toString());
    } else if (typeof rawEvent === 'string') {
      raw = JSON.parse(rawEvent);
    } else {
      raw = rawEvent as unknown as Record<string, unknown>;
    }

    if (isV2Event(raw)) {
      return {
        path: (raw.rawPath as string) || '/',
        httpMethod: extractMethodFromRouteKey(raw.routeKey as string) || 'GET',
        headers: (raw.headers as Record<string, string>) || {},
        queryParameters:
          (raw.queryStringParameters as Record<string, string>) ||
          parseQueryString(raw.rawQueryString as string) ||
          {},
        pathParameters: (raw.pathParameters as Record<string, string>) || {},
        body: (raw.body as string) ?? undefined,
        isBase64Encoded: (raw.isBase64Encoded as boolean) || false,
      };
    }

    // v1 (REST API)
    return {
      path: (raw.path as string) || '/',
      httpMethod: (raw.httpMethod as string) || 'GET',
      headers: (raw.headers as Record<string, string>) || {},
      queryParameters: (raw.queryStringParameters as Record<string, string>) || {},
      pathParameters: (raw.pathParameters as Record<string, string>) || {},
      body: (raw.body as string) ?? undefined,
      isBase64Encoded: (raw.isBase64Encoded as boolean) || false,
    };
  }

  formatResponse(response: ServerlessResponse): AwsResponse {
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
    const ctx = rawContext as Record<string, unknown>;
    return !!(ctx.awsRequestId || ctx.invokedFunctionArn || ctx.functionName);
  }
}

function isV2Event(event: Record<string, unknown>): boolean {
  return event.version === '2.0';
}

function extractMethodFromRouteKey(routeKey: string): string {
  return routeKey?.split(' ')[0] || 'GET';
}

function parseQueryString(raw: string): Record<string, string> {
  if (!raw) return {};
  const params: Record<string, string> = {};
  for (const part of raw.split('&')) {
    const [key, value] = part.split('=');
    if (key) params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
  }
  return params;
}
