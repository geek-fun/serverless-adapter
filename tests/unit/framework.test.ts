import { constructFramework } from '../../src/framework';
import Koa from 'koa2';

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
});
