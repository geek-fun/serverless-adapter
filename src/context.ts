import { Context, Event } from './types';
import ServerlessRequest from './serverlessRequest';
import url from 'node:url';
import ServerlessResponse from './serverlessResponse';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const constructFrameworkContext = (event: Event, _: Context) => {
  const request = new ServerlessRequest({
    method: event.httpMethod,
    headers: event.headers,
    body: Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'),
    remoteAddress: '',
    url: url.format({
      pathname: event.path,
      query: event.queryParameters,
    }),
    isBase64Encoded: event.isBase64Encoded,
  });
  const response = new ServerlessResponse(request);
  return { request, response };
};
