import { BaseProvider } from './base';
import {
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
  AwsResponse,
  EventClassification,
} from '../types';

/**
 * AWS Lambda + API Gateway Provider
 * Supports both REST API v1 and HTTP API v2 event formats
 */
export class AWSProvider extends BaseProvider {
  readonly name = 'aws' as const;

  /**
   * A Lambda function can be invoked by API Gateway, by EventBridge (scheduled
   * rules) and by other event sources, all through the same handler. Only the
   * API Gateway shapes can be answered; an EventBridge **Scheduler** invoking the
   * function with a custom input is indistinguishable from a hand-written HTTP
   * event, so only the documented `Scheduled Event` envelope is recognized as a
   * timer (see issue #23).
   */
  classifyEvent(rawEvent: ProviderEvent): EventClassification {
    const raw = this.parseEventPayload(rawEvent);
    if (!raw) {
      return { kind: 'unknown' };
    }

    if (raw['detail-type'] === 'Scheduled Event' && raw.source === 'aws.events') {
      const detail = scheduledRuleDetail(raw);
      return detail !== undefined ? { kind: 'timer', detail } : { kind: 'timer' };
    }

    if (isV2Event(raw) || isV1Event(raw)) {
      return { kind: 'http' };
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

/**
 * REST API v1 and ALB target events — both always carry `path` + `httpMethod`.
 * (VPC Lattice events are v2-shaped and match `isV2Event` instead.)
 */
function isV1Event(event: Record<string, unknown>): boolean {
  return typeof event.path === 'string' && typeof event.httpMethod === 'string';
}

/**
 * A stable identifier for a `Scheduled Event` envelope: the rule name from
 * `resources[0]` (`arn:aws:events:…:rule/<name>`) when present, falling back to
 * the per-invocation `id` UUID.
 */
function scheduledRuleDetail(event: Record<string, unknown>): string | undefined {
  const [resource] = Array.isArray(event.resources) ? event.resources : [];
  if (typeof resource === 'string') {
    const ruleName = resource.split('rule/').pop();
    if (ruleName) {
      return ruleName;
    }
  }

  return typeof event.id === 'string' ? event.id : undefined;
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
