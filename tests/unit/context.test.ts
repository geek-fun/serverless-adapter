import { constructFrameworkContext } from '../../src/context';
import { Context } from '../../src/types';
import { defaultContext } from '../fixtures/fcContext';

describe('context', () => {
  describe('constructFrameworkContext', () => {
    it('should construct context with string body', () => {
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: { 'content-type': 'application/json' },
        queryParameters: {},
        pathParameters: {},
        body: '{"key":"value"}',
        isBase64Encoded: false,
      };

      const { request } = constructFrameworkContext(
        Buffer.from(JSON.stringify(event)),
        defaultContext as Context,
      );

      expect(request.method).toBe('POST');
      expect(request.body).toBeInstanceOf(Buffer);
      expect(request.body?.toString()).toBe('{"key":"value"}');
    });

    it('should construct context with base64 encoded body', () => {
      const originalBody = 'hello world';
      const base64Body = Buffer.from(originalBody).toString('base64');
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: base64Body,
        isBase64Encoded: true,
      };

      const { request } = constructFrameworkContext(
        Buffer.from(JSON.stringify(event)),
        defaultContext as Context,
      );

      expect(request.body?.toString()).toBe(originalBody);
    });

    it('should construct context with object body', () => {
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: { key: 'value', nested: { foo: 'bar' } },
        isBase64Encoded: false,
      };

      const { request } = constructFrameworkContext(
        Buffer.from(JSON.stringify(event)),
        defaultContext as Context,
      );

      expect(JSON.parse(request.body?.toString() || '{}')).toEqual({
        key: 'value',
        nested: { foo: 'bar' },
      });
    });

    it('should construct context with undefined body', () => {
      const event = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const { request } = constructFrameworkContext(
        Buffer.from(JSON.stringify(event)),
        defaultContext as Context,
      );

      expect(request.body).toBeUndefined();
    });

    it('should throw error for unexpected body type', () => {
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: 123,
        isBase64Encoded: false,
      };

      expect(() => {
        constructFrameworkContext(Buffer.from(JSON.stringify(event)), defaultContext as Context);
      }).toThrow('Unexpected event.body type: number');
    });

    it('should lower case header keys', () => {
      const event = {
        path: '/test',
        httpMethod: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const { request } = constructFrameworkContext(
        Buffer.from(JSON.stringify(event)),
        defaultContext as Context,
      );

      expect(request.headers['content-type']).toBe('application/json');
      expect(request.headers['x-custom']).toBe('value');
    });

    it('should handle null headers', () => {
      const event = {
        path: '/test',
        httpMethod: 'GET',
        headers: null,
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const { request } = constructFrameworkContext(
        Buffer.from(JSON.stringify(event)),
        defaultContext as Context,
      );

      expect(request.headers).toEqual({ 'content-length': '0' });
    });

    it('should include query parameters in URL', () => {
      const event = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        queryParameters: { foo: 'bar', baz: 'qux' },
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const { request } = constructFrameworkContext(
        Buffer.from(JSON.stringify(event)),
        defaultContext as Context,
      );

      expect(request.url).toContain('foo=bar');
      expect(request.url).toContain('baz=qux');
    });

    it('should construct context with Buffer body', () => {
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        queryParameters: {},
        pathParameters: {},
        body: 'buffer content',
        isBase64Encoded: false,
      };

      const eventBuffer = Buffer.from(JSON.stringify(event));
      const { request } = constructFrameworkContext(eventBuffer, defaultContext as Context);

      expect(request.body).toBeInstanceOf(Buffer);
      expect(request.body?.toString()).toBe('buffer content');
    });
  });
});
