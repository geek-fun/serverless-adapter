import { Express } from 'express';
import Application from 'koa';
import ServerlessResponse from './serverlessResponse';
import ServerlessRequest from './serverlessRequest';

// eslint-disable-next-line
const callableFn = (callback: (req: any, res: any) => Promise<void>) => {
  return async (request: ServerlessRequest) => {
    const response = new ServerlessResponse(request);

    callback(request, response);

    return response;
  };
};

export const constructFramework = (app: Express | Application) => {
  if (app instanceof Application) {
    return callableFn(app.callback());
  } else if (typeof app === 'function') {
    return callableFn(app);
  } else {
    throw new Error(`Unsupported framework ${app}`);
  }
};
