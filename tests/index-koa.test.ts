import Koa from 'koa';
import Router from '@koa/router';
import koaBody from 'koa-body';
import serve from 'koa-static';
import { defaultContext, defaultEvent } from './fixtures/fcContext';
import { sendRequest } from './fixtures/requestHelper';

describe('koa', () => {
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
      ctx.body = 'Hello, world koa!';
    });
    app.use(router.routes());

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual('Hello, world koa!');
  });

  it('basic middleware should parse text body', async () => {
    router.post('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.body;
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'POST',
        body: 'hello, world',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': '12',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('hello, world');
  });

  it('basic middleware should parse json body', async () => {
    router.post('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.body.hello;
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('world');
  });

  it('basic middleware should get undefined body', async () => {
    router.post('/api/test', (ctx) => {
      ctx.status = 200;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      ctx.body = ctx.request.body.hello;
    });
    app.use(router.routes());

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

    expect(response.statusCode).toEqual(204);
    expect(response.body).toBeDefined();
  });

  it('basic middleware should get query params', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.query.foo;
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
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
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = 'foo';
    });
    router.put('/api/test', (ctx) => {
      ctx.status = 201;
      ctx.body = 'bar';
    });
    app.use(router.routes());

    const response = await sendRequest(app, { ...defaultEvent, httpMethod: 'PUT' }, defaultContext);

    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual('bar');
  });

  it('should serve files', async () => {
    app.use(serve('tests/fixtures'));

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
});
