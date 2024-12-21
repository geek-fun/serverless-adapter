import { Express } from 'express';
import Application from 'koa';
import { IncomingMessage, ServerResponse } from 'node:http';

const sendRequest = async (
  app: Express | Application,
  request: IncomingMessage,
  response: ServerResponse,
) => {
  if (app instanceof Application) {
    app.createContext(request, response);
  } else {
    app(request, response);
  }
};

export default sendRequest;
