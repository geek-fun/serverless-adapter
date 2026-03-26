import { VolcengineProvider } from '../../../src/providers/volcengine';
import { VolcengineApiGatewayEvent, VolcengineVefaasContext } from '../../../src/types/volcengine';
import { createVolcengineEvent, createVolcengineContext } from '../../fixtures/volcengineContext';

describe('VolcengineProvider', () => {
  let provider: VolcengineProvider;

  beforeEach(() => {
    provider = new VolcengineProvider();
  });

  describe('name', () => {
    it('should return "volcengine"', () => {
      expect(provider.name).toBe('volcengine');
    });
  });

  describe('normalizeEvent', () => {
    it('should normalize API Gateway event to ServerlessEvent', () => {
      const volcengineEvent: VolcengineApiGatewayEvent = {
        path: '/api/users',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        query: { page: '1' },
        body: '{"name":"test"}',
        requestContext: {
          requestId: 'req-abc',
          stage: 'release',
          serviceId: 'service-123',
        },
      };

      const rawEvent = Buffer.from(JSON.stringify(volcengineEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.path).toBe('/api/users');
      expect(result.httpMethod).toBe('POST');
      expect(result.body).toBe('{"name":"test"}');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.queryParameters).toEqual({ page: '1' });
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should handle event with no body', () => {
      const volcengineEvent = createVolcengineEvent({
        method: 'GET',
        body: '',
      });

      const rawEvent = Buffer.from(JSON.stringify(volcengineEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.body).toBe('');
    });

    it('should handle event without headers (use fallback)', () => {
      const volcengineEvent = createVolcengineEvent({
        headers: undefined as unknown as Record<string, string>,
      });

      const rawEvent = Buffer.from(JSON.stringify(volcengineEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.headers).toEqual({});
    });

    it('should handle event without query (use fallback)', () => {
      const volcengineEvent = createVolcengineEvent({
        query: undefined as unknown as Record<string, string>,
      });

      const rawEvent = Buffer.from(JSON.stringify(volcengineEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.queryParameters).toEqual({});
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
    it('should detect Volcengine context by requestId and region', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = createVolcengineContext();

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect Volcengine context by accountId', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = createVolcengineContext({
        credentials: undefined,
        function: undefined,
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect Volcengine context by credentials', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = createVolcengineContext({
        accountId: undefined,
        function: undefined,
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect Volcengine context by function', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = createVolcengineContext({
        accountId: undefined,
        credentials: undefined,
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect Volcengine context with service field (without service.name)', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = createVolcengineContext({
        service: {
          logProject: 'test-project',
          logStore: 'test-store',
          qualifier: '$LATEST',
          versionId: 'v1',
        },
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should not detect non-Volcengine context (missing requestId)', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = {
        region: 'cn-beijing',
        accountId: '123456',
      };

      expect(provider.detect(rawEvent, context as unknown as VolcengineVefaasContext)).toBe(false);
    });

    it('should not detect non-Volcengine context (missing region)', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = {
        requestId: 'test-id',
        accountId: '123456',
      };

      expect(provider.detect(rawEvent, context as unknown as VolcengineVefaasContext)).toBe(false);
    });

    it('should not detect Aliyun context', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = {
        requestId: 'test-id',
        region: 'cn-hangzhou',
        accountId: '123456',
        credentials: { accessKeyId: 'key', accessKeySecret: 'secret', securityToken: '' },
        service: { name: 'test-service' },
        tracing: { spanContext: 'span' },
      };

      expect(provider.detect(rawEvent, context as unknown as VolcengineVefaasContext)).toBe(false);
    });

    it('should not detect Tencent context', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = {
        tencentcloud_region: 'ap-guangzhou',
        namespace: 'default',
        tencentcloud_appid: '123456',
      };

      expect(provider.detect(rawEvent, context as unknown as VolcengineVefaasContext)).toBe(false);
    });
  });
});
