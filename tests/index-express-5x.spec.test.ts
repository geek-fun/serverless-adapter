import express, { Express, Request, Response } from 'express5';
import { defaultContext, defaultEvent } from './fixtures/fcContext';
import { sendRequest } from './fixtures/requestHelper';
import { constructFrameworkContext } from '../src/context';
import { Context } from '../src/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const onFinished = require('on-finished');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getRawBody = require('raw-body');

describe('express 5.x', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it('basic middleware should set statusCode and default body', async () => {
    app.use((req: Request, res: Response) => {
      res.status(418).send(`I'm a teapot`);
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);
    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual(`I'm a teapot`);
  });

  it('express.json() should parse json body', async () => {
    app.use(express.json());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body.hello);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('world');
  });

  it('express.text() should parse text body', async () => {
    app.use(express.text());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'POST',
        body: 'hello, world',
        headers: {
          'Content-Type': 'text/plain',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('hello, world');
  });

  it('basic middleware should get undefined body', async () => {
    app.use(express.json());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body?.hello);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'POST',
        body: undefined,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toBeDefined();
  });

  it('basic middleware should get query params', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.query.foo as string);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        path: '/',
        queryParameters: {
          foo: 'bar',
        },
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('bar');
  });

  it('should match verbs', async () => {
    app.get('/api/test', (req: Request, res: Response) => {
      res.status(200).send('foo');
    });
    app.put('/api/test', (req: Request, res: Response) => {
      res.status(201).send('bar');
    });

    const response = await sendRequest(app, { ...defaultEvent, httpMethod: 'PUT' }, defaultContext);

    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual('bar');
  });

  it('should serve files', async () => {
    app.use(express.static('tests/fixtures'));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        path: '/file.txt',
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('this is a test\n');
  });

  it('serverless request should not be marked as finished before body is consumed', () => {
    const event = {
      ...defaultEvent,
      httpMethod: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      headers: { 'Content-Type': 'application/json' },
    };
    const { request } = constructFrameworkContext(
      Buffer.from(JSON.stringify(event)),
      defaultContext as Context,
    );
    expect(onFinished.isFinished(request)).toBe(false);
  });

  it('serverless request body should be readable via raw-body', async () => {
    const event = {
      ...defaultEvent,
      httpMethod: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      headers: { 'Content-Type': 'application/json' },
    };
    const { request } = constructFrameworkContext(
      Buffer.from(JSON.stringify(event)),
      defaultContext as Context,
    );
    const body = await getRawBody(request, { encoding: 'utf-8' });
    expect(JSON.parse(body)).toEqual({ hello: 'world' });
  });
});
