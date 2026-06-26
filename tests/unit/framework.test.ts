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
  });
});
