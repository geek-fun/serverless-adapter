import { Hono } from 'hono';
import { defaultContext, defaultEvent } from './fixtures/fcContext';
import { sendRequest } from './fixtures/requestHelper';

describe('Hono with Aliyun provider', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  // 1. Happy path: JSON response
  it('should return JSON response', async () => {
    app.get('/api/test', (c) => c.json({ ok: true }));

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  // 2. Status code + text body
  it('should set custom status code and return text body', async () => {
    app.get('/api/test', (c) => {
      c.status(418);
      return c.text("I'm a teapot");
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual("I'm a teapot");
  });

  // 3. GET with single query param
  it('should read single query parameter', async () => {
    app.get('/api/test', (c) => c.text(c.req.query('foo') || ''));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        queryParameters: { foo: 'bar' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('bar');
  });

  // 4. Multiple query params
  it('should read all query parameters as JSON', async () => {
    app.get('/api/test', (c) => c.json(c.req.query()));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        queryParameters: { foo: 'bar', baz: 'qux', num: '123' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({
      foo: 'bar',
      baz: 'qux',
      num: '123',
    });
  });

  // 5. Path params
  it('should extract path parameters from URL', async () => {
    app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/users/123',
        pathParameters: { id: '123' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ id: '123' });
  });

  // 6. POST JSON body
  it('should parse JSON request body', async () => {
    app.post('/api', async (c) => {
      const body = await c.req.json();
      return c.json(body);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ hello: 'world' });
  });

  // 7. POST text body
  it('should read text request body', async () => {
    app.post('/api', async (c) => {
      const body = await c.req.text();
      return c.text(body);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'POST',
        body: 'hello, world',
        headers: { 'Content-Type': 'text/plain' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('hello, world');
  });

  // 8. POST raw body (arrayBuffer)
  it('should read raw request body as arrayBuffer', async () => {
    app.post('/api', async (c) => {
      const buf = await c.req.arrayBuffer();
      return c.text(new TextDecoder().decode(buf));
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'POST',
        body: 'raw binary data',
        headers: { 'Content-Type': 'application/octet-stream' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('raw binary data');
  });

  // 9. Empty body GET
  it('should handle request with undefined body', async () => {
    app.get('/api/test', (c) => c.json({ ok: true }));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        body: undefined,
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  // 10. Base64-encoded request body
  it('should decode base64-encoded request body', async () => {
    // Handler appends "!" so we can prove Hono received decoded "hello"
    // not the raw base64 "aGVsbG8=". The response body is then re-base64-encoded
    // by buildResponse because request.isBase64Encoded is true.
    app.post('/api', async (c) => {
      const text = await c.req.text();
      return c.text(text + '!');
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'POST',
        body: 'aGVsbG8=', // base64 of "hello"
        isBase64Encoded: true,
        headers: { 'Content-Type': 'text/plain' },
      },
      defaultContext,
    );

    // Hono received "hello", responded "hello!"
    // buildResponse re-base64-encodes: Buffer.from("hello!").toString('base64') = "aGVsbG8h"
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('aGVsbG8h');
  });

  // 11. Custom response headers
  it('should set custom response headers', async () => {
    app.get('/api/test', (c) => {
      c.header('X-Custom', 'value');
      return c.text('ok');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('ok');
    expect(response.headers['x-custom']).toBeDefined();
    expect(response.headers['x-custom']).toEqual('value');
  });

  // 12. Multiple Set-Cookie headers
  it('should handle multiple set-cookie headers via multiValueHeaders', async () => {
    app.get('/api/test', (c) => {
      c.header('Set-Cookie', 'a=1');
      c.header('Set-Cookie', 'b=2', { append: true });
      return c.text('ok');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('ok');
    expect(response.multiValueHeaders?.['set-cookie']).toEqual(['a=1', 'b=2']);
  });

  // 12b. Single Set-Cookie header (different code path: string vs array)
  it('should handle single set-cookie header', async () => {
    app.get('/api/test', (c) => {
      c.header('Set-Cookie', 'session=abc123');
      return c.text('ok');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('ok');
    expect(response.headers['set-cookie']).toBe('session=abc123');
  });

  // 13. Empty response body (204)
  it('should return empty body with 204 status', async () => {
    app.get('/api/test', (c) => {
      c.status(204);
      return c.body(null);
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(204);
    expect(response.body).toEqual('');
  });

  // 14. 404 unmatched route
  it('should return 404 for unmatched routes', async () => {
    app.get('/api/exists', (c) => c.text('exists'));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api/nonexistent',
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(404);
  });

  // 15. Error handling
  it('should return 500 when handler throws', async () => {
    app.get('/api/test', () => {
      throw new Error('boom');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(500);
  });

  // 16. Method matching (GET vs PUT)
  it('should match different HTTP methods', async () => {
    app.get('/api', (c) => c.text('GET'));
    app.put('/api', (c) => c.text('PUT'));

    const getResponse = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'GET',
      },
      defaultContext,
    );

    expect(getResponse.statusCode).toEqual(200);
    expect(getResponse.body).toEqual('GET');

    const putResponse = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'PUT',
      },
      defaultContext,
    );

    expect(putResponse.statusCode).toEqual(200);
    expect(putResponse.body).toEqual('PUT');
  });

  // 17. DELETE method
  it('should handle DELETE method', async () => {
    app.delete('/api', (c) => c.text('deleted'));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'DELETE',
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('deleted');
  });

  // 18. PATCH method
  it('should handle PATCH method with JSON body', async () => {
    app.patch('/api', async (c) => {
      const body = await c.req.json();
      return c.json(body);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        httpMethod: 'PATCH',
        body: JSON.stringify({ updated: true }),
        headers: { 'Content-Type': 'application/json' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ updated: true });
  });

  // 19. Request headers pass-through
  it('should pass request headers through to handler', async () => {
    app.get('/api', (c) => c.text(c.req.header('authorization') || ''));

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        path: '/api',
        headers: { Authorization: 'Bearer test-token' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('Bearer test-token');
  });

  // 20. isBase64Encoded flag for text responses
  it('should set isBase64Encoded false for text/plain response', async () => {
    app.get('/api/test', (c) => c.text('hello'));

    const response = await sendRequest(
      app,
      { ...defaultEvent, isBase64Encoded: false },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.isBase64Encoded).toEqual(false);
  });

  // 21. isBase64Encoded flag for binary image responses
  it('should set isBase64Encoded true for image/png binary response', async () => {
    const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    app.get('/api/test', (c) => {
      c.header('content-type', 'image/png');
      return c.body(pngData.buffer);
    });

    const response = await sendRequest(
      app,
      { ...defaultEvent, isBase64Encoded: false },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.isBase64Encoded).toBe(true);
    expect(response.body).toBe(Buffer.from(pngData).toString('base64'));
  });

  // 22. isBase64Encoded should NOT be set for text/html even with Buffer body
  it('should set isBase64Encoded false for text/html response', async () => {
    app.get('/api/test', (c) => {
      c.header('content-type', 'text/html');
      return c.body('<html></html>');
    });

    const response = await sendRequest(
      app,
      { ...defaultEvent, isBase64Encoded: false },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.isBase64Encoded).toEqual(false);
    expect(response.body).toBe('<html></html>');
  });
});
