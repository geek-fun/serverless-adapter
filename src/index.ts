import { Express } from 'express';
import Application from 'koa';
import { ServerlessAdapter } from './types';
import { IncomingHttpHeaders } from 'http';
import { constructFrameworkContext } from './context';
import { buildResponse, waitForStreamComplete } from './transport';
import { constructFramework } from './framework';
import { debug } from './common';

const serverlessAdapter: ServerlessAdapter = (app: Express | Application) => {
  const serverlessFramework = constructFramework(app);
  return async (event, context) => {
    debug(`serverlessAdapter receive event: ${JSON.stringify({ event, context })}`);
    const { request } = constructFrameworkContext(event, context);
    debug(`serverlessAdapter constructFrameworkContext: ${JSON.stringify({ request })}`);
    try {
      const response = await serverlessFramework(request);
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
