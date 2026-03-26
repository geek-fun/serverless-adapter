import express from 'express4';
import serverlessAdapter from '../../src/index';
import { defaultContext } from '../fixtures/fcContext';
import { createTencentContext, createTencentEvent } from '../fixtures/tencentContext';
import { ProviderContext } from '../../src/types';

describe('serverlessAdapter', () => {
  it('should handle successful request', async () => {
    const app = express();
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'success' });
    });

    const handler = serverlessAdapter(app);
    const event = {
      path: '/test',
      httpMethod: 'GET',
      headers: {},
      queryParameters: {},
      pathParameters: {},
      body: undefined,
      isBase64Encoded: false,
    };

    const result = await handler(Buffer.from(JSON.stringify(event)), defaultContext);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"message":"success"}');
  });

  it('should handle POST request with JSON body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', (req, res) => {
      res.status(200).json({ received: req.body });
    });

    const handler = serverlessAdapter(app);
    const event = {
      path: '/test',
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      queryParameters: {},
      pathParameters: {},
      body: JSON.stringify({ foo: 'bar' }),
      isBase64Encoded: false,
    };

    const result = await handler(Buffer.from(JSON.stringify(event)), defaultContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ received: { foo: 'bar' } });
  });

  it('should handle errors and return 500', async () => {
    const app = express();
    app.get('/api/test', () => {
      throw new Error('intentional test error');
    });

    const handler = serverlessAdapter(app);
    const event = {
      path: '/api/test',
      httpMethod: 'GET',
      headers: {},
      queryParameters: {},
      pathParameters: {},
      body: undefined,
      isBase64Encoded: false,
    };

    const result = await handler(Buffer.from(JSON.stringify(event)), defaultContext);

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('intentional test error');
  });

  it('should handle request with query parameters', async () => {
    const app = express();
    app.get('/test', (req, res) => {
      res.status(200).json({ query: req.query });
    });

    const handler = serverlessAdapter(app);
    const event = {
      path: '/test',
      httpMethod: 'GET',
      headers: {},
      queryParameters: { foo: 'bar', baz: 'qux' },
      pathParameters: {},
      body: undefined,
      isBase64Encoded: false,
    };

    const result = await handler(Buffer.from(JSON.stringify(event)), defaultContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ query: { foo: 'bar', baz: 'qux' } });
  });

  it('should handle request with headers', async () => {
    const app = express();
    app.get('/test', (req, res) => {
      res.status(200).json({ 'content-type': req.headers['content-type'] });
    });

    const handler = serverlessAdapter(app);
    const event = {
      path: '/test',
      httpMethod: 'GET',
      headers: { 'content-type': 'application/json' },
      queryParameters: {},
      pathParameters: {},
      body: undefined,
      isBase64Encoded: false,
    };

    const result = await handler(Buffer.from(JSON.stringify(event)), defaultContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ 'content-type': 'application/json' });
  });

  it('should handle base64 encoded response', async () => {
    const app = express();
    app.get('/test', (req, res) => {
      res.status(200).send('hello world');
    });

    const handler = serverlessAdapter(app);
    const event = {
      path: '/test',
      httpMethod: 'GET',
      headers: {},
      queryParameters: {},
      pathParameters: {},
      body: undefined,
      isBase64Encoded: true,
    };

    const result = await handler(Buffer.from(JSON.stringify(event)), defaultContext);

    expect(result.statusCode).toBe(200);
    expect(result.isBase64Encoded).toBe(true);
  });

  it('should throw error when provider cannot be detected', async () => {
    const app = express();
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'success' });
    });

    const handler = serverlessAdapter(app);
    const event = {
      path: '/test',
      httpMethod: 'GET',
      headers: {},
      queryParameters: {},
      pathParameters: {},
      body: undefined,
      isBase64Encoded: false,
    };

    const unknownContext = { unknown: true } as unknown as ProviderContext;

    await expect(handler(Buffer.from(JSON.stringify(event)), unknownContext)).rejects.toThrow(
      'Unable to detect cloud provider. Please specify provider option.',
    );
  });

  it('should use explicit provider when specified', async () => {
    const app = express();
    app.get('/api/test', (req, res) => {
      res.status(200).json({ message: 'tencent success' });
    });

    const handler = serverlessAdapter(app, { provider: 'tencent' });
    const tencentEvent = createTencentEvent();
    const tencentContext = createTencentContext();

    const result = await handler(Buffer.from(JSON.stringify(tencentEvent)), tencentContext);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"message":"tencent success"}');
  });

  it('should handle Tencent SCF event correctly', async () => {
    const app = express();
    app.get('/api/test', (req, res) => {
      res.status(200).json({ message: 'tencent handler' });
    });

    const handler = serverlessAdapter(app);
    const tencentEvent = createTencentEvent({
      httpMethod: 'GET',
    });
    const tencentContext = createTencentContext();

    const result = await handler(Buffer.from(JSON.stringify(tencentEvent)), tencentContext);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"message":"tencent handler"}');
  });
});
