import Koa from 'koa2';
import Router from '@koa/router';
import { createAwsContext, createAwsV1Event } from './fixtures/awsContext';
import { sendRequest } from './fixtures/requestHelper';

describe('AWS Lambda + API Gateway with Koa 2.x', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
  });

  it('basic middleware should set statusCode and default body', async () => {
    app.use((ctx) => {
      ctx.status = 418;
      ctx.body = `I'm a teapot`;
    });

    const response = await sendRequest(
      app,
      createAwsV1Event() as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );
    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual(`I'm a teapot`);
  });

  it('should get query params', async () => {
    app.use((ctx) => {
      ctx.status = 200;
      ctx.body = ctx.query.foo as string;
    });

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'GET',
        queryStringParameters: { foo: 'bar' },
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('bar');
  });

  it('should handle POST with JSON body', async () => {
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.body = { received: ctx.request.body || ctx.query };
    });

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );
    expect(response.statusCode).toEqual(200);
  });

  it('should handle custom headers in response', async () => {
    app.use((ctx) => {
      ctx.set('X-Custom-Header', 'custom-value');
      ctx.set('X-Another', 'another-value');
      ctx.status = 200;
      ctx.body = 'ok';
    });

    const response = await sendRequest(
      app,
      createAwsV1Event() as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.headers['x-custom-header']).toEqual('custom-value');
    expect(response.headers['x-another']).toEqual('another-value');
  });

  it('should handle response with JSON', async () => {
    app.use((ctx) => {
      ctx.status = 200;
      ctx.body = { message: 'hello', count: 42 };
    });

    const response = await sendRequest(
      app,
      createAwsV1Event() as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'hello', count: 42 });
  });

  it('should handle empty response body', async () => {
    app.use((ctx) => {
      ctx.status = 204;
    });

    const response = await sendRequest(
      app,
      createAwsV1Event() as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(204);
    expect(response.body).toEqual('');
  });

  it('should handle 500 error from middleware', async () => {
    app.use(() => {
      throw new Error('Internal server error');
    });

    const response = await sendRequest(
      app,
      createAwsV1Event() as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(500);
  });

  it('should handle request with router', async () => {
    const router = new Router();
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = { route: 'test' };
    });

    app.use(router.routes());

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'GET',
        path: '/api/test',
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ route: 'test' });
  });

  it('should handle 404 response', async () => {
    app.use((ctx) => {
      ctx.status = 404;
      ctx.body = 'Not Found';
    });

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'GET',
        path: '/api/notexists',
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(404);
  });
});
