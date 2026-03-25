import Koa from 'koa2';
import Router from '@koa/router';
import koaBody from 'koa-body';
import serve from 'koa-static';
import { defaultContext, defaultEvent } from './fixtures/fcContext';
import { sendRequest } from './fixtures/requestHelper';

describe('koa 2.x', () => {
  let app: Koa;
  let router: Router;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    app = new Koa();
    app.use(koaBody({ text: true, json: true, multipart: true, urlencoded: true }));
    router = new Router();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
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
      ctx.body = ctx.request.body?.hello;
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

  it('should handle DELETE method', async () => {
    router.delete('/api/test', (ctx) => {
      ctx.status = 204;
      ctx.body = 'deleted';
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'DELETE',
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(204);
  });

  it('should handle PATCH method', async () => {
    router.patch('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = 'patched';
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'PATCH',
        body: JSON.stringify({ update: 'value' }),
        headers: { 'Content-Type': 'application/json' },
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('patched');
  });

  it('should handle custom headers in response', async () => {
    router.get('/api/test', (ctx) => {
      ctx.set('X-Custom-Header', 'custom-value');
      ctx.set('X-Another', 'another-value');
      ctx.status = 200;
      ctx.body = 'ok';
    });
    app.use(router.routes());

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(response.headers['x-custom-header']).toEqual('custom-value');
    expect(response.headers['x-another']).toEqual('another-value');
  });

  it('should handle response with JSON', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = { message: 'hello', count: 42 };
    });
    app.use(router.routes());

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'hello', count: 42 });
  });

  it('should handle empty response body', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 204;
      ctx.body = '';
    });
    app.use(router.routes());

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(204);
    expect(response.body).toEqual('');
  });

  it('should handle error from middleware', async () => {
    app.use(() => {
      throw new Error('Koa error');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(500);
  });

  it('should handle request with multiple query parameters', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.query;
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        queryParameters: {
          foo: 'bar',
          baz: 'qux',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({
      foo: 'bar',
      baz: 'qux',
    });
  });

  it('should handle 404 response', async () => {
    router.get('/api/exists', (ctx) => {
      ctx.status = 200;
      ctx.body = 'exists';
    });
    app.use(router.routes());

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        path: '/api/notexists',
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(404);
  });
});
