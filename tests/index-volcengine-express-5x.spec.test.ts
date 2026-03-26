import express, { Express, Request, Response } from 'express5';
import { createVolcengineContext, createVolcengineEvent } from './fixtures/volcengineContext';
import { sendRequest } from './fixtures/requestHelper';

describe('Volcengine veFaaS with Express 5.x', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it('basic middleware should set statusCode and default body', async () => {
    app.use((req: Request, res: Response) => {
      res.status(418).send(`I'm a teapot`);
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );
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
      createVolcengineEvent({
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('world');
  });

  it('basic middleware should get query params', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.query.foo as string);
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent({
        method: 'GET',
        query: { foo: 'bar' },
      }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
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

    const response = await sendRequest(
      app,
      createVolcengineEvent({ method: 'PUT' }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual('bar');
  });

  it('should handle custom headers in response', async () => {
    app.use((req: Request, res: Response) => {
      res.setHeader('X-Custom-Header', 'custom-value');
      res.status(200).send('ok');
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.headers['x-custom-header']).toEqual('custom-value');
  });

  it('should handle response with JSON', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).json({ message: 'hello', count: 42 });
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'hello', count: 42 });
  });

  it('should handle 500 error from middleware', async () => {
    app.use(() => {
      throw new Error('Internal server error');
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(500);
  });

  it('should handle 404 response', async () => {
    app.get('/api/exists', (req: Request, res: Response) => {
      res.status(200).send('exists');
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent({
        method: 'GET',
        path: '/api/notexists',
      }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(404);
  });
});
