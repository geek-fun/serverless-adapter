import { Hono } from 'hono';
import { createTencentContext, createTencentFunctionUrlEvent } from './fixtures/tencentContext';
import { sendRequest } from './fixtures/requestHelper';

describe('Tencent SCF Function URL with Hono', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it('happy path: GET should return JSON response', async () => {
    app.get('/*', (c) => c.json({ ok: true }));

    const response = await sendRequest(
      app,
      createTencentFunctionUrlEvent() as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it('Query params: GET should echo query parameters from queryString', async () => {
    app.get('/*', (c) => c.json(c.req.query()));

    const response = await sendRequest(
      app,
      createTencentFunctionUrlEvent({
        queryString: { a: '1', b: 'hello world' },
      }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ a: '1', b: 'hello world' });
  });

  it('JSON body: POST should echo body back', async () => {
    app.post('/*', async (c) => {
      const body = await c.req.json();
      return c.json(body);
    });

    const response = await sendRequest(
      app,
      createTencentFunctionUrlEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ hello: 'world' });
  });

  it('Custom headers: GET should return custom header', async () => {
    app.get('/*', (c) => {
      c.header('X-Custom', 'value');
      return c.text('ok');
    });

    const response = await sendRequest(
      app,
      createTencentFunctionUrlEvent() as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('ok');
    expect(response.headers['x-custom']).toEqual('value');
  });

  it('404: unmatched route should return 404', async () => {
    app.get('/api/exists', (c) => c.text('exists'));

    const response = await sendRequest(
      app,
      createTencentFunctionUrlEvent({
        path: '/api/notexists',
      }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(404);
  });

  it('Function URL response should NOT include isBase64Encoded or multiValueHeaders', async () => {
    app.get('/*', (c) => c.json({ provider: 'tencent' }));

    const response = await sendRequest(
      app,
      createTencentFunctionUrlEvent() as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(response).not.toHaveProperty('isBase64Encoded');
    expect(response).not.toHaveProperty('multiValueHeaders');
  });

  it('500 error: route that throws should return 500', async () => {
    app.get('/*', () => {
      throw new Error('boom');
    });

    const response = await sendRequest(
      app,
      createTencentFunctionUrlEvent() as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(500);
  });
});
