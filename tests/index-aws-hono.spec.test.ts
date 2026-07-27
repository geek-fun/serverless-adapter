import { Hono } from 'hono';
import { createAwsContext, createAwsV1Event, createAwsV2Event } from './fixtures/awsContext';
import { sendRequest } from './fixtures/requestHelper';

describe('AWS Lambda + API Gateway with Hono', () => {
  it('should handle basic GET request with v1 event', async () => {
    const app = new Hono();
    app.get('/', (c) => c.json({ message: 'Hello from AWS Hono!' }));

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'GET',
        path: '/',
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'Hello from AWS Hono!' });
  });

  it('should handle basic GET request with v2 event', async () => {
    const app = new Hono();
    app.get('/', (c) => c.json({ version: '2.0' }));

    const response = await sendRequest(
      app,
      createAwsV2Event({
        routeKey: 'GET /',
        rawPath: '/',
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ version: '2.0' });
  });

  it('should accept query parameters', async () => {
    const app = new Hono();
    app.get('/search', (c) => c.json({ q: c.req.query('q') }));

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'GET',
        path: '/search',
        queryStringParameters: { q: 'test' },
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ q: 'test' });
  });

  it('should accept JSON body', async () => {
    const app = new Hono();
    app.post('/submit', async (c) => {
      const body = await c.req.json();
      return c.json({ received: body });
    });

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'POST',
        path: '/submit',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ received: { name: 'test' } });
  });

  it('should handle 404', async () => {
    const app = new Hono();
    app.get('/exists', (c) => c.text('ok'));

    const response = await sendRequest(
      app,
      createAwsV1Event({
        httpMethod: 'GET',
        path: '/notexists',
      }) as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response.statusCode).toEqual(404);
  });
});
