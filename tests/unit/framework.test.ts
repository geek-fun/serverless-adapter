import { constructFramework } from '../../src/framework';
import Koa from 'koa2';
import { Hono } from 'hono';
import ServerlessResponse from '../../src/serverlessResponse';
import ServerlessRequest from '../../src/serverlessRequest';

describe('framework', () => {
  describe('constructFramework', () => {
    it('should detect Koa app by callback method', () => {
      const app = new Koa();
      const result = constructFramework(app);
      expect(typeof result).toBe('function');
    });

    it('should detect Express app as function', () => {
      const mockExpress = jest.fn() as unknown as ((req: unknown, res: unknown) => void) & {
        callback?: unknown;
      };
      const result = constructFramework(mockExpress);
      expect(typeof result).toBe('function');
    });

    it('should throw error for unsupported framework', () => {
      const unsupportedApp = { notACallback: true };

      expect(() => constructFramework(unsupportedApp)).toThrow(
        'Unsupported framework [object Object]',
      );
    });
  });

  describe('Hono', () => {
    it('should detect Hono app by fetch method', () => {
      const app = new Hono();
      const result = constructFramework(app);
      expect(typeof result).toBe('function');
    });

    it('honoHandler should convert ServerlessRequest to Web API Request and back to ServerlessResponse', async () => {
      const app = new Hono();
      app.get('/api/test', (c) => c.json({ ok: true }));

      const handler = constructFramework(app);
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        headers: {},
        body: undefined,
        remoteAddress: '',
        isBase64Encoded: false,
      });

      const response = await handler(request);

      expect(response.statusCode).toBe(200);
      expect(ServerlessResponse.body(response).toString()).toBe('{"ok":true}');
    });

    it('should handle array-valued IncomingHttpHeaders in honoHandler', async () => {
      const app = new Hono();
      app.get('/api/test', (c) => {
        const val = c.req.header('x-array');
        return c.text(val || 'none');
      });

      const handler = constructFramework(app);
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        headers: { 'x-array': 'v1' } as { [key: string]: string | number },
        body: undefined,
        remoteAddress: '',
        isBase64Encoded: false,
      });
      Object.assign(request, { headers: { 'x-array': ['v1', 'v2'] } });

      const response = await handler(request);

      expect(response.statusCode).toBe(200);
      // Multi-valued headers are joined with ', ' in the Request
      expect(ServerlessResponse.body(response).toString()).toBe('v1, v2');
    });

    it('should handle POST with body in honoHandler (hasBody = true)', async () => {
      const app = new Hono();
      app.post('/api', async (c) => {
        const body = await c.req.text();
        return c.text(body);
      });

      const handler = constructFramework(app);
      const request = new ServerlessRequest({
        method: 'POST',
        url: '/api',
        path: '/api',
        headers: { 'content-type': 'text/plain' },
        body: Buffer.from('hello'),
        remoteAddress: '',
        isBase64Encoded: false,
      });

      const response = await handler(request);
      expect(response.statusCode).toBe(200);
      expect(ServerlessResponse.body(response).toString()).toBe('hello');
    });
  });
});
