import { Express, Request, Response } from 'express';

const serverlessHandler = async (
  app: Express,
  context: { request: Request; response: Response },
) => {
  const request: Request = context.request;
  const response: Response = context.response;

  await new Promise<void>((resolve, reject) => {
    app(request, response, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  return response;
};

export default serverlessHandler;
