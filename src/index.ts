import { Express } from 'express';
import { ServerlessAdapter } from './types';
import sendRequest from './sendRequest';
import { IncomingHttpHeaders } from 'http';
import { constructFrameworkContext } from './context';
import { buildResponse, waitForStreamComplete } from './transport';

const serverlessAdapter: ServerlessAdapter = (app: Express) => {
  return async (event, context) => {
    const { request, response } = constructFrameworkContext(event, context);

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      await sendRequest(app, request, response);
      await waitForStreamComplete(response);
      return buildResponse({ request, response });
    } catch (err) {
      const errorResponse = { statusCode: 500, body: (err as Error).message };
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
