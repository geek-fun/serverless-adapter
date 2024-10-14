import { Express } from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';

const sendRequest = async (app: Express, request: IncomingMessage, response: ServerResponse) => {
  app(request, response);
};

export default sendRequest;
