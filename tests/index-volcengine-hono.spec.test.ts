import { Hono } from 'hono';
import { createVolcengineContext, createVolcengineEvent } from './fixtures/volcengineContext';
import { sendRequest } from './fixtures/requestHelper';

describe('Volcengine veFaaS with Hono', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it('happy path: GET should return JSON response', async () => {
    app.get('/*', (c) => c.json({ ok: true }));

    const response = await sendRequest(
      app,
      createVolcengineEvent({ method: 'GET' }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
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
      createVolcengineEvent({
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ hello: 'world' });
  });

  it('Query params: GET should echo query parameters', async () => {
    app.get('/*', (c) => c.json(c.req.query()));

    const response = await sendRequest(
      app,
      createVolcengineEvent({
        method: 'GET',
        query: { foo: 'bar' },
      }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
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
      createVolcengineEvent({ method: 'GET' }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('ok');
    expect(response.headers['x-custom']).toEqual('value');
  });

  it('404: unmatched route should return 404', async () => {
    app.get('/api/exists', (c) => c.text('exists'));

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

  it('500 error: route that throws should return 500', async () => {
    app.get('/*', () => {
      throw new Error('Internal server error');
    });

    const response = await sendRequest(
      app,
      createVolcengineEvent({ method: 'GET' }) as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(500);
  });

  it('should return Volcengine veFaaS response format', async () => {
    app.get('/*', (c) => c.json({ provider: 'volcengine' }));

    const response = await sendRequest(
      app,
      createVolcengineEvent() as unknown as Record<string, unknown>,
      createVolcengineContext() as unknown as Record<string, unknown>,
    );

    expect(response).toHaveProperty('statusCode');
    expect(response).toHaveProperty('body');
    expect(response).toHaveProperty('headers');
  });
});
