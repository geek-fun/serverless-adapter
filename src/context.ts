import { Context, Event } from './types';
import ServerlessRequest from './serverlessRequest';
import url from 'node:url';
import { debug } from './common';

// const requestRemoteAddress = (event) => {
//   if (event.version === '2.0') {
//     return event.requestContext.http.sourceIp;
//   }
//   return event.requestContext.identity.sourceIp;
// };

const requestBody = (event: Event) => {
  if (event.body === undefined || event.body === null) {
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

export const constructFrameworkContext = (event: Event, context: Context) => {
  debug(`constructFrameworkContext: ${JSON.stringify({ event, context })}`);
  const request = new ServerlessRequest({
    method: event.httpMethod,
    headers: event.headers,
    path: event.path,
    body: requestBody(event),
    remoteAddress: '',
    url: url.format({
      pathname: event.path,
      query: event.queryParameters,
    }),
    isBase64Encoded: event.isBase64Encoded,
  });

  return { request };
};
