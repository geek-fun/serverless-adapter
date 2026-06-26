import { Hono } from 'hono';
import { createTencentContext, createTencentEvent } from './fixtures/tencentContext';
import { sendRequest } from './fixtures/requestHelper';

describe('Tencent SCF with Hono', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it('happy path: GET should return JSON response', async () => {
    app.get('/*', (c) => c.json({ ok: true }));

    const response = await sendRequest(
      app,
      createTencentEvent({ httpMethod: 'GET' }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it('JSON body: POST should echo body back', async () => {
    app.post('/*', async (c) => {
      const body = await c.req.json();
      return c.json(body);
    });

    const response = await sendRequest(
      app,
      createTencentEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ hello: 'world' });
  });

  it('Query params: GET should echo query parameters', async () => {
    app.get('/*', (c) => c.json(c.req.query()));

    const response = await sendRequest(
      app,
      createTencentEvent({
        httpMethod: 'GET',
        queryStringParameters: { foo: 'bar' },
      }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ foo: 'bar' });
  });

  it('Custom headers: GET should return custom header', async () => {
    app.get('/*', (c) => {
      c.header('X-Custom', 'value');
      return c.text('ok');
    });

    const response = await sendRequest(
      app,
      createTencentEvent({ httpMethod: 'GET' }) as unknown as Record<string, unknown>,
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
      createTencentEvent({
        httpMethod: 'GET',
        path: '/api/notexists',
      }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(404);
  });

  it('500 error: route that throws should return 500', async () => {
    app.get('/*', () => {
      throw new Error('Internal server error');
    });

    const response = await sendRequest(
      app,
      createTencentEvent({ httpMethod: 'GET' }) as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(500);
  });

  it('should return Tencent SCF response format', async () => {
    app.get('/*', (c) => c.json({ provider: 'tencent' }));

    const response = await sendRequest(
      app,
      createTencentEvent() as unknown as Record<string, unknown>,
      createTencentContext() as unknown as Record<string, unknown>,
    );

    expect(response).toHaveProperty('statusCode');
    expect(response).toHaveProperty('body');
    expect(response).toHaveProperty('headers');
    expect(response).toHaveProperty('isBase64Encoded');
  });
});
