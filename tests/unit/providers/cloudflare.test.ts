import { Express } from 'express';

import serverlessAdapter from '../../../src/index';
import { CloudflareProvider } from '../../../src/providers/cloudflare';
import { CloudflareWorkerContext } from '../../../src/types';

const waitUntilContext = (): CloudflareWorkerContext => ({
  waitUntil: () => void 0,
});

type MinimalRes = {
  statusCode: number;
  setHeader: (name: string, value: string) => unknown;
  end: (body?: unknown) => unknown;
};

const jsonApp = ((_req: unknown, res: MinimalRes) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}) as unknown as Express;

describe('CloudflareProvider', () => {
  let provider: CloudflareProvider;

  beforeEach(() => {
    provider = new CloudflareProvider();
  });

  describe('name', () => {
    it('should return "cloudflare"', () => {
      expect(provider.name).toBe('cloudflare');
    });
  });

  describe('normalizeEvent', () => {
    it('should normalize a POST Request with body, query and headers', async () => {
      const request = new Request('https://worker.example.com/api/users?page=1&size=10', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name":"geekfun"}',
      });

      const result = await provider.normalizeEvent(request);

      expect(result.path).toBe('/api/users');
      expect(result.httpMethod).toBe('POST');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.queryParameters).toEqual({ page: '1', size: '10' });
      expect(result.pathParameters).toEqual({});
      expect(Buffer.isBuffer(result.body)).toBe(true);
      expect((result.body as Buffer).toString()).toBe('{"name":"geekfun"}');
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should skip the body for GET requests', async () => {
      const request = new Request('https://worker.example.com/api/users', { method: 'GET' });

      const result = await provider.normalizeEvent(request);

      expect(result.httpMethod).toBe('GET');
      expect(result.body).toBeUndefined();
    });

    it('should skip the body for HEAD requests', async () => {
      const request = new Request('https://worker.example.com/api/users', { method: 'HEAD' });

      const result = await provider.normalizeEvent(request);

      expect(result.body).toBeUndefined();
    });

    it('should keep binary bodies intact', async () => {
      const binary = Uint8Array.from([0x00, 0x01, 0xff, 0x80]);
      const request = new Request('https://worker.example.com/upload', {
        method: 'POST',
        body: binary,
      });

      const result = await provider.normalizeEvent(request);

      expect(Buffer.compare(result.body as Buffer, Buffer.from(binary))).toBe(0);
    });
  });

  describe('createRequest', () => {
    it('should create a ServerlessRequest from the normalized event', async () => {
      const event = await provider.normalizeEvent(
        new Request('https://worker.example.com/test?foo=bar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"key":"value"}',
        }),
      );

      const { request, isBase64Encoded } = provider.createRequest(event);

      expect(request.method).toBe('POST');
      expect(request.url).toBe('/test?foo=bar');
      expect(request.headers['content-type']).toBe('application/json');
      expect(isBase64Encoded).toBe(false);
    });
  });

  describe('formatResponse', () => {
    it('should format the response preserving all fields', () => {
      const result = provider.formatResponse({
        statusCode: 200,
        body: '{"message":"success"}',
        headers: { 'Content-Type': 'application/json' },
        isBase64Encoded: false,
        multiValueHeaders: { 'set-cookie': ['a=1', 'b=2'] },
      });

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('{"message":"success"}');
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(result.isBase64Encoded).toBe(false);
      expect(result.multiValueHeaders).toEqual({ 'set-cookie': ['a=1', 'b=2'] });
    });
  });

  describe('detect', () => {
    it('should detect a web Request with a waitUntil context', () => {
      const event = new Request('https://worker.example.com/');
      expect(provider.detect(event, waitUntilContext())).toBe(true);
    });

    it('should not detect a Buffer event even with a waitUntil context', () => {
      const event = Buffer.from(JSON.stringify({ path: '/' }));
      expect(provider.detect(event, waitUntilContext())).toBe(false);
    });

    it('should not detect a Request without a waitUntil context', () => {
      const event = new Request('https://worker.example.com/');
      expect(provider.detect(event, {} as CloudflareWorkerContext)).toBe(false);
    });

    it('should not detect non-cloudflare contexts', () => {
      const event = Buffer.from(JSON.stringify({}));
      const context = { awsRequestId: 'req-1', functionName: 'fn' };
      expect(provider.detect(event, context as unknown as CloudflareWorkerContext)).toBe(false);
    });
  });

  describe('serverlessAdapter integration', () => {
    it('should handle a Request end-to-end with explicit provider', async () => {
      const handler = serverlessAdapter(jsonApp, { provider: 'cloudflare' });

      const result = await handler(
        new Request('https://worker.example.com/api/hello?page=2', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"name":"geekfun"}',
        }),
        waitUntilContext(),
      );

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('{"ok":true}');
      expect(result.headers['content-type']).toBe('application/json');
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should auto-detect the cloudflare provider from a Request with waitUntil context', async () => {
      const handler = serverlessAdapter(jsonApp);

      const result = await handler(
        new Request('https://worker.example.com/api/hello', { method: 'GET' }),
        waitUntilContext(),
      );

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('{"ok":true}');
    });

    it('should encode binary responses as base64', async () => {
      const binaryApp = ((_req: unknown, res: MinimalRes) => {
        res.statusCode = 200;
        res.setHeader('content-type', 'image/png');
        res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      }) as unknown as Express;

      const handler = serverlessAdapter(binaryApp, { provider: 'cloudflare' });

      const result = await handler(
        new Request('https://worker.example.com/logo.png', { method: 'GET' }),
        waitUntilContext(),
      );

      expect(result.isBase64Encoded).toBe(true);
      expect(Buffer.from(result.body, 'base64')).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });
  });
});
