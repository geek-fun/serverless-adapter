import { Express } from 'express';
import { Writable } from 'stream';
import { Context, Event, ServerlessAdapter } from './types';
import sendRequest from './sendRequest';
import ServerlessRequest from './serverlessRequest';
import ServerlessResponse from './serverlessResponse';
import { IncomingHttpHeaders } from 'http';

const constructFrameworkContext = (event: Event, context: Context) => {
  console.log('constructFrameworkContext', event, context);
  const request = new ServerlessRequest({
    method: event.httpMethod,
    headers: event.headers,
    body: Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'),
    remoteAddress: '',
    url: event.path,
    isBase64Encoded: event.isBase64Encoded,
  });
  const response = new ServerlessResponse(request);
  return { request, response };
};

const waitForStreamComplete = (stream: Writable): Promise<Writable> => {
  if (stream.writableFinished || stream.writableEnded) {
    return Promise.resolve(stream);
  }

  return new Promise((resolve, reject) => {
    stream.once('error', complete);
    stream.once('end', complete);
    stream.once('finish', complete);

    let isComplete = false;

    function complete(err?: Error) {
      if (isComplete) {
        return;
      }

      isComplete = true;

      stream.removeListener('error', complete);
      stream.removeListener('end', complete);
      stream.removeListener('finish', complete);

      if (err) {
        reject(err);
      } else {
        resolve(stream);
      }
    }
  });
};

const buildResponse = ({
  request,
  response,
}: {
  request: ServerlessRequest;
  response: ServerlessResponse;
}) => {
  return {
    statusCode: response.statusCode,
    body: ServerlessResponse.body(response).toString(request.isBase64Encoded ? 'base64' : 'utf8'),
    headers: response.headers,
    isBase64Encoded: request.isBase64Encoded,
  };
};

const serverlessAdapter: ServerlessAdapter = (app: Express) => {
  return async (event, context) => {
    const ctx = constructFrameworkContext(event, context);

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      await sendRequest(app, ctx.request, ctx.response);
      await waitForStreamComplete(ctx.response);
      return buildResponse(ctx);
    } catch (err) {
      const errorResponse = { statusCode: 500, body: (err as Error).message };
      console.log('Error occurred during request handling:', err);
      return errorResponse as unknown as {
        statusCode: number;
        body: string;
        headers: IncomingHttpHeaders;
        isBase64Encoded: boolean;
      };
    }
  };
};

export default serverlessAdapter;
