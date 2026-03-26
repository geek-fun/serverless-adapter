import Koa from 'koa3';
import Router from '@koa/router';
import koaBody from 'koa-body';
import { createVolcengineContext, createVolcengineEvent } from './fixtures/volcengineContext';
import { sendRequest } from './fixtures/requestHelper';

describe('Volcengine veFaaS with Koa 3.x', () => {
  let app: Koa;
  let router: Router;

  beforeEach(() => {
    app = new Koa();
    app.use(koaBody({ text: true, json: true, multipart: true, urlencoded: true }));
    router = new Router();
  });

  it('basic middleware should set statusCode and default body', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 418;
      ctx.body = 'Hello, Volcengine veFaaS!';
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual('Hello, Volcengine veFaaS!');
  });

  it('basic middleware should parse json body', async () => {
    router.post('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.body.hello;
    });
    app.use(router.routes());

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
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.query.foo;
    });
    app.use(router.routes());

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
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = 'foo';
    });
    router.put('/api/test', (ctx) => {
      ctx.status = 201;
      ctx.body = 'bar';
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      createVolcengineEvent({ method: 'PUT' }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual('bar');
  });

  it('should handle custom headers in response', async () => {
    router.get('/api/test', (ctx) => {
      ctx.set('X-Custom-Header', 'custom-value');
      ctx.status = 200;
      ctx.body = 'ok';
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.headers['x-custom-header']).toEqual('custom-value');
  });

  it('should handle response with JSON', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = { message: 'hello', count: 42 };
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'hello', count: 42 });
  });

  it('should handle error from middleware', async () => {
    app.use(() => {
      throw new Error('Koa error');
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(500);
  });

  it('should handle 404 response', async () => {
    router.get('/api/exists', (ctx) => {
      ctx.status = 200;
      ctx.body = 'exists';
    });
    app.use(router.routes());

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
