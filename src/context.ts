import { Context, ServerlessEvent } from './types';
import ServerlessRequest from './serverlessRequest';
import url from 'node:url';
import { debug } from './common';

// const requestRemoteAddress = (event) => {
//   if (event.version === '2.0') {
//     return event.requestContext.http.sourceIp;
//   }
//   return event.requestContext.identity.sourceIp;
// };

const requestBody = (event: ServerlessEvent) => {
  if (!event.body) {
    return undefined;
  }
  const type = typeof event.body;

  if (Buffer.isBuffer(event.body)) {
    return event.body;
  } else if (type === 'string') {
    return Buffer.from(event.body as string, event.isBase64Encoded ? 'base64' : 'utf8');
  } else if (type === 'object') {
    return Buffer.from(JSON.stringify(event.body));
  }

  throw new Error(`Unexpected event.body type: ${typeof event.body}`);
};

const requestHeaders = (event: ServerlessEvent) => {
  const initialHeader = {} as Record<string, string>;

  // if (event.multiValueHeaders) {
  //   Object.keys(event.multiValueHeaders).reduce((headers, key) => {
  //     headers[key.toLowerCase()] = event.multiValueHeaders[key].join(', ');
  //     return headers;
  //   }, initialHeader);
  // }

  return Object.keys(event.headers ?? {}).reduce((headers, key) => {
    headers[key.toLowerCase()] = event.headers[key];
    return headers;
  }, initialHeader);
};

export const constructFrameworkContext = (rawEvent: Buffer, rawContext: Context) => {
  debug(`constructFrameworkContext: ${JSON.stringify({ rawEvent, rawContext })}`);
  const event = JSON.parse(Buffer.from(rawEvent).toString()) as ServerlessEvent;
  const body = requestBody(event);
  const headers = requestHeaders(event);

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

  return { request };
};
