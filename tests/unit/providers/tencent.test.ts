import { TencentProvider } from '../../../src/providers/tencent';
import { TencentApiGatewayEvent } from '../../../src/types/tencent';
import { TencentScfContext } from '../../../src/types/tencent';
import {
  createTencentEvent,
  createTencentContext,
  createTencentFunctionUrlEvent,
} from '../../fixtures/tencentContext';

describe('TencentProvider', () => {
  let provider: TencentProvider;

  beforeEach(() => {
    provider = new TencentProvider();
  });

  describe('name', () => {
    it('should return "tencent"', () => {
      expect(provider.name).toBe('tencent');
    });
  });

  describe('normalizeEvent', () => {
    it('should normalize API Gateway event to ServerlessEvent', () => {
      const tencentEvent: TencentApiGatewayEvent = {
        requestContext: {
          serviceId: 'service-123',
          path: '/api/users',
          httpMethod: 'POST',
          requestId: 'req-abc',
          identity: {},
          sourceIp: '10.0.0.1',
          stage: 'release',
        },
        path: '/api/users',
        httpMethod: 'POST',
        queryString: { page: '1' },
        body: '{"name":"test"}',
        headers: { 'content-type': 'application/json' },
        pathParameters: {},
        queryStringParameters: { page: '1' },
        headerParameters: {},
        stageVariables: {},
      };

      const rawEvent = Buffer.from(JSON.stringify(tencentEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.path).toBe('/api/users');
      expect(result.httpMethod).toBe('POST');
      expect(result.body).toBe('{"name":"test"}');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.queryParameters).toEqual({ page: '1' });
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should handle event with no body', () => {
      const tencentEvent = createTencentEvent({
        httpMethod: 'GET',
        body: '',
      });

      const rawEvent = Buffer.from(JSON.stringify(tencentEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.body).toBe('');
    });

    it('should handle event without headers (use fallback)', () => {
      const tencentEvent = createTencentEvent({
        headers: undefined as unknown as Record<string, string>,
      });

      const rawEvent = Buffer.from(JSON.stringify(tencentEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.headers).toEqual({});
    });

    it('should handle event without queryStringParameters (use fallback)', () => {
      const tencentEvent = createTencentEvent({
        queryStringParameters: undefined as unknown as Record<string, string>,
      });

      const rawEvent = Buffer.from(JSON.stringify(tencentEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.queryParameters).toEqual({});
    });

    it('should handle event without pathParameters (use fallback)', () => {
      const tencentEvent = createTencentEvent({
        pathParameters: undefined as unknown as Record<string, string>,
      });

      const rawEvent = Buffer.from(JSON.stringify(tencentEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.pathParameters).toEqual({});
    });
  });

  describe('Function URL event', () => {
    it('should map queryString to queryParameters for Function URL event', () => {
      const rawEvent = Buffer.from(
        JSON.stringify(
          createTencentFunctionUrlEvent({
            httpMethod: 'POST',
            path: '/api/users',
            body: '{"name":"test"}',
            headers: { 'content-type': 'application/json' },
            queryString: { a: '1', b: 'hello world' },
          }),
        ),
      );

      const result = provider.normalizeEvent(rawEvent);

      expect(result.path).toBe('/api/users');
      expect(result.httpMethod).toBe('POST');
      expect(result.body).toBe('{"name":"test"}');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.queryParameters).toEqual({ a: '1', b: 'hello world' });
      expect(result.pathParameters).toEqual({});
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should treat null-injected legacy fields as Function URL event', () => {
      const rawEvent = Buffer.from(
        JSON.stringify({
          body: '{"a":1}',
          headers: { 'content-type': 'application/json' },
          httpMethod: 'POST',
          path: '/',
          queryString: { a: '1' },
          queryStringParameters: null,
          requestContext: null,
        }),
      );

      const result = provider.normalizeEvent(rawEvent);

      expect(result.queryParameters).toEqual({ a: '1' });
    });

    it('should handle null headers and null body for Function URL event', () => {
      const rawEvent = Buffer.from(
        JSON.stringify(createTencentFunctionUrlEvent({ headers: null, body: null })),
      );

      const result = provider.normalizeEvent(rawEvent);

      expect(result.headers).toEqual({});
      expect(result.body).toBeNull();
    });

    it('should default queryParameters to {} when queryString absent for Function URL', () => {
      const rawEvent = Buffer.from(
        JSON.stringify(createTencentFunctionUrlEvent({ queryString: undefined })),
      );

      const result = provider.normalizeEvent(rawEvent);

      expect(result.queryParameters).toEqual({});
    });

    it('should default path to / when missing for Function URL event', () => {
      const rawEvent = Buffer.from(
        JSON.stringify(createTencentFunctionUrlEvent({ path: undefined })),
      );

      const result = provider.normalizeEvent(rawEvent);

      expect(result.path).toBe('/');
    });

    it('should strip isBase64Encoded and multiValueHeaders for Function URL', () => {
      provider.normalizeEvent(Buffer.from(JSON.stringify(createTencentFunctionUrlEvent())));

      const result = provider.formatResponse({
        statusCode: 201,
        body: '{"message":"Hello"}',
        headers: { 'Content-Type': 'application/json' },
        isBase64Encoded: false,
        multiValueHeaders: { 'set-cookie': ['a=1'] },
      });

      expect(result.statusCode).toBe(201);
      expect(result.body).toBe('{"message":"Hello"}');
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(result).not.toHaveProperty('isBase64Encoded');
      expect(result).not.toHaveProperty('multiValueHeaders');
    });

    it('should strip isBase64Encoded even for binary response in Function URL', () => {
      provider.normalizeEvent(Buffer.from(JSON.stringify(createTencentFunctionUrlEvent())));

      const result = provider.formatResponse({
        statusCode: 200,
        body: 'aGVsbG8=',
        headers: { 'content-type': 'image/png' },
        isBase64Encoded: true,
        multiValueHeaders: {},
      });

      expect(result.isBase64Encoded).toBeUndefined();
      expect(result.multiValueHeaders).toBeUndefined();
    });

    it('should detect Tencent context for Function URL event', () => {
      const rawEvent = Buffer.from(JSON.stringify(createTencentFunctionUrlEvent()));

      expect(provider.detect(rawEvent, createTencentContext())).toBe(true);
    });
  });

  describe('createRequest', () => {
    it('should create ServerlessRequest from normalized event', () => {
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: { 'content-type': 'application/json' },
        queryParameters: { foo: 'bar' },
        pathParameters: {},
        body: '{"key":"value"}',
        isBase64Encoded: false,
      };

      const { request, isBase64Encoded } = provider.createRequest(event);

      expect(request.method).toBe('POST');
      expect(request.url).toBe('/test?foo=bar');
      expect(request.headers['content-type']).toBe('application/json');
      expect(isBase64Encoded).toBe(false);
    });

    it('should create request with base64 encoded body', () => {
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

      const { request, isBase64Encoded } = provider.createRequest(event);

      expect(isBase64Encoded).toBe(true);
      expect(request.body?.toString()).toBe(originalBody);
    });

    it('should handle query parameters in URL', () => {
      const event = {
        path: '/search',
        httpMethod: 'GET',
        headers: {},
        queryParameters: { q: 'test', page: '1' },
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const { request } = provider.createRequest(event);

      expect(request.url).toContain('q=test');
      expect(request.url).toContain('page=1');
    });

    it('should handle Buffer body', () => {
      const bufferBody = Buffer.from('buffer content');
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: bufferBody,
        isBase64Encoded: false,
      };

      const { request } = provider.createRequest(event);

      expect(request.body).toBe(bufferBody);
    });

    it('should handle object body', () => {
      const event = {
        path: '/test',
        httpMethod: 'POST',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: { key: 'value', nested: { foo: 'bar' } },
        isBase64Encoded: false,
      };

      const { request } = provider.createRequest(event);

      expect(JSON.parse(request.body?.toString() || '{}')).toEqual({
        key: 'value',
        nested: { foo: 'bar' },
      });
    });

    it('should handle null headers', () => {
      const event = {
        path: '/test',
        httpMethod: 'GET',
        headers: null as unknown as Record<string, string>,
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const { request } = provider.createRequest(event);

      expect(request.headers).toEqual({ 'content-length': '0' });
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

      expect(() => provider.createRequest(event)).toThrow('Unexpected event.body type: number');
    });

    it('should handle event without query parameters', () => {
      const event = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const { request } = provider.createRequest(event);

      expect(request.url).toBe('/test');
    });
  });

  describe('formatResponse', () => {
    it('should format response correctly', () => {
      const response = {
        statusCode: 200,
        body: '{"message":"success"}',
        headers: { 'Content-Type': 'application/json' },
        isBase64Encoded: false,
      };

      const result = provider.formatResponse(response);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('{"message":"success"}');
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should handle error responses', () => {
      const response = {
        statusCode: 500,
        body: 'Internal Server Error',
        headers: {},
        isBase64Encoded: false,
      };

      const result = provider.formatResponse(response);

      expect(result.statusCode).toBe(500);
      expect(result.body).toBe('Internal Server Error');
    });
  });

  describe('detect', () => {
    it('should detect Tencent context by tencentcloud_region', () => {
      const rawEvent = Buffer.from(JSON.stringify(createTencentEvent()));
      const context = createTencentContext();

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect Tencent context by tencentcloud_appid', () => {
      const rawEvent = Buffer.from(JSON.stringify(createTencentEvent()));
      const context = createTencentContext({
        tencentcloud_region: undefined as unknown as string,
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect Tencent context by namespace', () => {
      const rawEvent = Buffer.from(JSON.stringify(createTencentEvent()));
      const context = createTencentContext({
        tencentcloud_region: undefined as unknown as string,
        tencentcloud_appid: undefined as unknown as string,
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should not detect non-Tencent context', () => {
      const rawEvent = Buffer.from(JSON.stringify(createTencentEvent()));
      const context = {
        requestId: 'test-id',
        region: 'cn-hangzhou',
        accountId: '123456',
      };

      expect(provider.detect(rawEvent, context as unknown as TencentScfContext)).toBe(false);
    });
  });
});
