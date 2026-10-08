import {
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
  CloudProvider,
  EventClassification,
} from '../types';
import ServerlessRequest from '../serverlessRequest';
import url from 'node:url';
import { debug, decodeRawEvent } from '../common';

export interface ProviderNormalizeResult {
  request: ServerlessRequest;
  isBase64Encoded: boolean;
}

export interface ServerlessProvider {
  readonly name: CloudProvider;
  // Async allowed for providers whose event body must be read from a stream (e.g. Cloudflare Request)
  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent | Promise<ServerlessEvent>;
  createRequest(event: ServerlessEvent): ProviderNormalizeResult;
  formatResponse(response: ServerlessResponse): unknown;
  detect(rawEvent: ProviderEvent, rawContext: ProviderContext): boolean;
  /**
   * Classify a raw invocation before it is normalized, so that non-HTTP
   * invocations are never coerced into a request for the web framework.
   *
   * Optional: providers registered outside this package that do not implement it
   * keep the historical permissive behaviour.
   */
  classifyEvent?(rawEvent: ProviderEvent): EventClassification;
}

export abstract class BaseProvider implements ServerlessProvider {
  abstract readonly name: CloudProvider;

  abstract normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent | Promise<ServerlessEvent>;

  abstract detect(rawEvent: ProviderEvent, rawContext: ProviderContext): boolean;

  /**
   * Parse a raw invocation into a plain object: Buffer and JSON string events are
   * parsed, already-parsed objects are returned as-is, and anything unparseable
   * yields `undefined` (the caller turns that into an `unknown` classification).
   */
  protected parseEventPayload(rawEvent: ProviderEvent): Record<string, unknown> | undefined {
    const parsed = decodeRawEvent(rawEvent);

    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return undefined;
  }

  /**
   * Positive HTTP markers shared by the API-Gateway style providers. A scheduled
   * or queue event carries none of these fields, so it is never mistaken for an
   * HTTP request.
   */
  protected looksLikeHttpEvent(raw: Record<string, unknown>): boolean {
    return (
      typeof raw.path === 'string' ||
      typeof raw.rawPath === 'string' ||
      typeof raw.httpMethod === 'string' ||
      typeof raw.method === 'string'
    );
  }

  createRequest(event: ServerlessEvent): ProviderNormalizeResult {
    debug(`${this.name}Provider createRequest: ${JSON.stringify({ event })}`);
    const body = this.parseBody(event);
    const headers = this.normalizeHeaders(event.headers);

    const request = new ServerlessRequest({
      method: event.httpMethod,
      path: event.path,
      headers,
      body,
      remoteAddress: '',
      url: url.format({
        pathname: event.path,
        query: event.queryParameters,
      }),
      isBase64Encoded: event.isBase64Encoded,
    });

    return { request, isBase64Encoded: event.isBase64Encoded };
  }

  abstract formatResponse(response: ServerlessResponse): unknown;

  protected parseBody(event: ServerlessEvent): Buffer | undefined {
    if (!event.body) {
      return undefined;
    }

    if (Buffer.isBuffer(event.body)) {
      return event.body;
    }

    const type = typeof event.body;

    if (type === 'string') {
      return Buffer.from(event.body as string, event.isBase64Encoded ? 'base64' : 'utf8');
    }

    if (type === 'object') {
      return Buffer.from(JSON.stringify(event.body));
    }

    throw new Error(`Unexpected event.body type: ${typeof event.body}`);
  }

  protected normalizeHeaders(headers: Record<string, string> | null): Record<string, string> {
    if (!headers) {
      return {};
    }

    return Object.keys(headers).reduce(
      (acc, key) => {
        acc[key.toLowerCase()] = headers[key];
        return acc;
      },
      {} as Record<string, string>,
    );
  }
}
