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

// eslint-disable-next-line
export const constructFramework = (app: any) => {
  if (typeof app.callback === 'function') {
    // Koa
    return callableFn(app.callback());
  } else if (typeof app === 'function') {
    // Express
    return callableFn(app);
  } else {
    throw new Error(`Unsupported framework ${app}`);
  }
};
