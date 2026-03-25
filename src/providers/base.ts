import {
  ServerlessEvent,
  ServerlessResponse,
  ProviderContext,
  ProviderEvent,
  CloudProvider,
} from '../types';
import ServerlessRequest from '../serverlessRequest';
import url from 'node:url';
import { debug } from '../common';

export interface ProviderNormalizeResult {
  request: ServerlessRequest;
  isBase64Encoded: boolean;
}

export interface ServerlessProvider {
  readonly name: CloudProvider;
  normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent;
  createRequest(event: ServerlessEvent): ProviderNormalizeResult;
  formatResponse(response: ServerlessResponse): unknown;
  detect(rawEvent: ProviderEvent, rawContext: ProviderContext): boolean;
}

export abstract class BaseProvider implements ServerlessProvider {
  abstract readonly name: CloudProvider;

  abstract normalizeEvent(rawEvent: ProviderEvent): ServerlessEvent;

  abstract detect(rawEvent: ProviderEvent, rawContext: ProviderContext): boolean;

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
