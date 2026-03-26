import { AliyunProvider } from '../../../src/providers/aliyun';
import { defaultContext } from '../../fixtures/fcContext';
import { AliyunApiGatewayContext } from '../../../src/types/aliyun';

describe('AliyunProvider', () => {
  let provider: AliyunProvider;

  beforeEach(() => {
    provider = new AliyunProvider();
  });

  describe('name', () => {
    it('should return "aliyun"', () => {
      expect(provider.name).toBe('aliyun');
    });
  });

  describe('normalizeEvent', () => {
    it('should normalize Aliyun event to ServerlessEvent', () => {
      const aliyunEvent = {
        path: '/api/users',
        httpMethod: 'POST',
        headers: { 'content-type': 'application/json' },
        queryParameters: { page: '1' },
        pathParameters: { id: '123' },
        body: '{"name":"test"}',
        isBase64Encoded: false,
      };

      const rawEvent = Buffer.from(JSON.stringify(aliyunEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.path).toBe('/api/users');
      expect(result.httpMethod).toBe('POST');
      expect(result.body).toBe('{"name":"test"}');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.queryParameters).toEqual({ page: '1' });
      expect(result.pathParameters).toEqual({ id: '123' });
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should handle event with no body', () => {
      const aliyunEvent = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const rawEvent = Buffer.from(JSON.stringify(aliyunEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.body).toBeUndefined();
    });

    it('should handle event with base64 encoded body', () => {
      const originalBody = 'hello world';
      const base64Body = Buffer.from(originalBody).toString('base64');
      const aliyunEvent = {
        path: '/test',
        httpMethod: 'POST',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: base64Body,
        isBase64Encoded: true,
      };

      const rawEvent = Buffer.from(JSON.stringify(aliyunEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.isBase64Encoded).toBe(true);
    });

    it('should handle event without headers (use fallback)', () => {
      const aliyunEvent = {
        path: '/test',
        httpMethod: 'GET',
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const rawEvent = Buffer.from(JSON.stringify(aliyunEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.headers).toEqual({});
    });

    it('should handle event without queryParameters (use fallback)', () => {
      const aliyunEvent = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const rawEvent = Buffer.from(JSON.stringify(aliyunEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.queryParameters).toEqual({});
    });

    it('should handle event without pathParameters (use fallback)', () => {
      const aliyunEvent = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        queryParameters: {},
        body: undefined,
        isBase64Encoded: false,
      };

      const rawEvent = Buffer.from(JSON.stringify(aliyunEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.pathParameters).toEqual({});
    });

    it('should handle event without isBase64Encoded (use fallback)', () => {
      const aliyunEvent = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: undefined,
      };

      const rawEvent = Buffer.from(JSON.stringify(aliyunEvent));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.isBase64Encoded).toBe(false);
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
  });

  describe('detect', () => {
    it('should detect Aliyun context by accountId', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      expect(provider.detect(rawEvent, defaultContext as AliyunApiGatewayContext)).toBe(true);
    });

    it('should detect Aliyun context by credentials', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context: Partial<AliyunApiGatewayContext> = {
        credentials: {
          accessKeyId: 'test-key',
          accessKeySecret: 'test-secret',
          securityToken: '',
        },
        function: {
          name: 'test-function',
          handler: 'index.handler',
          memory: 128,
          timeout: 30,
          initializer: '',
        },
      };

      expect(provider.detect(rawEvent, context as AliyunApiGatewayContext)).toBe(true);
    });

    it('should detect Aliyun context by service', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context: Partial<AliyunApiGatewayContext> = {
        service: {
          name: 'test-service',
          logProject: '',
          logStore: '',
          qualifier: '',
          versionId: '',
        },
      };

      expect(provider.detect(rawEvent, context as AliyunApiGatewayContext)).toBe(true);
    });

    it('should detect Aliyun context by tracing', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context: Partial<AliyunApiGatewayContext> = {
        tracing: {
          spanContext: 'test-span',
          jaegerEndpoint: '',
          spanBaggages: {},
          parseOpenTracingBaggages: () => ({}),
        },
      };

      expect(provider.detect(rawEvent, context as AliyunApiGatewayContext)).toBe(true);
    });

    it('should not detect non-Aliyun context', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = {
        tencentcloud_region: 'ap-guangzhou',
        namespace: 'default',
      };

      expect(provider.detect(rawEvent, context as unknown as AliyunApiGatewayContext)).toBe(false);
    });
  });
});
