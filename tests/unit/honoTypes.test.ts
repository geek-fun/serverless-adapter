import serverlessAdapter from '../../src/index';
import { Hono } from 'hono';

describe('Hono type acceptance', () => {
  it('should accept Hono app in serverlessAdapter type signature', () => {
    const app = new Hono();
    // Type widened to accept HonoApp — verifies Hono is accepted
    const handler = serverlessAdapter(app);
    expect(typeof handler).toBe('function');
  });
});
