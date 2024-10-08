import { Express, Request, Response } from 'express';
import { Context, Event, ServerlessAdapter } from './types';
import serverlessHandler from './serverlessHandler';

// const CONTEXT_HEADER_NAME = 'x-fc-http-context';

// const getRequestHeaders = (ctx: { request: Request }) => {
//   const request = ctx.request;
//   const headers = { ...request.headers };
//   return headers;
// };
//
// const getSocketPath = (): string => {
//   const socketPathSuffix = Math.random().toString(36).substring(2, 15);
//   if (/^win/.test(process.platform)) {
//     const path = require('path');
//     return path.join('\\\\?\\pipe', process.cwd(), `server-${socketPathSuffix}`);
//   } else {
//     return `/tmp/server-${socketPathSuffix}.sock`;
//   }
// };

// const getBody = async (request: Request): Promise<string> => {
//   return new Promise((resolve, reject) => {
//     if (!request.on) {
//       resolve('');
//     }
//     try {
//       getRawBody(request).then(resolve, reject);
//     } catch (e) {
//       reject(e);
//     }
//   });
// };
//
// const makeResolver = (ctx) => {
//   return data => {
//     const response = ctx.response;
//     if (response.setStatusCode) {
//       response.setStatusCode(data.statusCode);
//     } else {
//       response.status = data.statusCode;
//       response.statusCode = data.statusCode;
//     }
//     for (const key in data.headers) {
//       if (data.headers.hasOwnProperty(key)) {
//         const value = data.headers[key];
//         response.setHeader(key, value);
//       }
//     }
//     for (const key in data.multiValueHeaders) {
//       const value = data.multiValueHeaders[key]
//       response.setHeader(key, value)
//     }
//     if (response.send) {
//       response.send(data.body);
//     } else {
//       response.end(data.body);
//     }
//   };
// }
//

const constructFrameworkContext = (event: Event, context: Context) => {
  console.log('constructFrameworkContext', event, context);
  return {
    request: {
      ...event,
      get: (name: string) => event.headers[name.toLowerCase()],
    } as unknown as Request,
    response: {} as unknown as Response,
  };
};

const serverlessAdapter: ServerlessAdapter = (app: Express) => {
  return async (event, context) => {
    const ctx = constructFrameworkContext(event, context);

    try {
      return (await serverlessHandler(app, ctx)) as unknown as {
        statusCode: number;
        body: unknown;
      };
    } catch (err) {
      const errorResponse = { statusCode: 500, body: (err as Error).message };
      console.log('Error occurred during request handling:', err);
      return errorResponse as unknown as { statusCode: number; body: unknown };
    }
  };
};

export default serverlessAdapter;

export const hello = () => 'hello';
