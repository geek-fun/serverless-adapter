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

export const constructFrameworkContext = (event: Event, context: Context) => {
  debug(`constructFrameworkContext: ${JSON.stringify({ event, context })}`);
  const request = new ServerlessRequest({
    method: event.httpMethod,
    headers: event.headers,
    path: event.path,
    body:
      event.body !== undefined && event.body !== null
        ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
        : undefined,
    remoteAddress: '',
    url: url.format({
      pathname: event.path,
      query: event.queryParameters,
    }),
    isBase64Encoded: event.isBase64Encoded,
  });

  return { request };
};
