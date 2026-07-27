import { AWSProvider } from '../../../src/providers/aws';
import {
  AwsApiGatewayV1Event,
  AwsApiGatewayV2Event,
  AwsLambdaContext,
} from '../../../src/types/aws';
import { createAwsV1Event, createAwsV2Event, createAwsContext } from '../../fixtures/awsContext';

describe('AWSProvider', () => {
  let provider: AWSProvider;

  beforeEach(() => {
    provider = new AWSProvider();
  });

  describe('name', () => {
    it('should return "aws"', () => {
      expect(provider.name).toBe('aws');
    });
  });

  describe('normalizeEvent (v1 - REST API)', () => {
    it('should normalize v1 API Gateway event to ServerlessEvent', () => {
      const v1Event: AwsApiGatewayV1Event = {
        path: '/api/users',
        httpMethod: 'POST',
        headers: { 'content-type': 'application/json' },
        queryStringParameters: { page: '1' },
        pathParameters: { id: '123' },
        body: '{"name":"test"}',
        isBase64Encoded: false,
        requestContext: {
          stage: 'dev',
          requestId: 'req-abc',
          identity: { sourceIp: '10.0.0.1' },
        },
      };

      const rawEvent = Buffer.from(JSON.stringify(v1Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.path).toBe('/api/users');
      expect(result.httpMethod).toBe('POST');
      expect(result.body).toBe('{"name":"test"}');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.queryParameters).toEqual({ page: '1' });
      expect(result.pathParameters).toEqual({ id: '123' });
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should handle v1 event with no body', () => {
      const v1Event = createAwsV1Event({
        httpMethod: 'GET',
        body: null,
      });

      const rawEvent = Buffer.from(JSON.stringify(v1Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.body).toBeUndefined();
    });

    it('should handle v1 event without headers (use fallback)', () => {
      const v1Event = createAwsV1Event({
        headers: undefined as unknown as Record<string, string>,
      });

      const rawEvent = Buffer.from(JSON.stringify(v1Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.headers).toEqual({});
    });

    it('should handle v1 event without queryStringParameters (use fallback)', () => {
      const v1Event = createAwsV1Event({
        queryStringParameters: undefined,
      });

      const rawEvent = Buffer.from(JSON.stringify(v1Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.queryParameters).toEqual({});
    });

    it('should handle v1 event without pathParameters (use fallback)', () => {
      const v1Event = createAwsV1Event({
        pathParameters: undefined,
      });

      const rawEvent = Buffer.from(JSON.stringify(v1Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.pathParameters).toEqual({});
    });

    it('should handle v1 event without isBase64Encoded (use fallback)', () => {
      const v1Event = {
        path: '/test',
        httpMethod: 'GET',
        headers: {},
        body: null,
        requestContext: {
          stage: 'dev',
          requestId: 'req-abc',
          identity: {},
        },
      };

      const rawEvent = Buffer.from(JSON.stringify(v1Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.isBase64Encoded).toBe(false);
    });

    it('should handle v1 event as plain object (not Buffer)', () => {
      const v1Event = createAwsV1Event({
        httpMethod: 'DELETE',
        path: '/api/items/1',
      });

      const result = provider.normalizeEvent(v1Event as unknown as Buffer);

      expect(result.path).toBe('/api/items/1');
      expect(result.httpMethod).toBe('DELETE');
    });

    it('should handle v1 event as string', () => {
      const v1Event = createAwsV1Event({
        httpMethod: 'PUT',
        path: '/api/items',
      });

      const rawEvent = JSON.stringify(v1Event);
      const result = provider.normalizeEvent(rawEvent as unknown as Buffer);

      expect(result.path).toBe('/api/items');
      expect(result.httpMethod).toBe('PUT');
    });

    it('should handle v1 base64 encoded body', () => {
      const originalBody = 'hello world';
      const base64Body = Buffer.from(originalBody).toString('base64');
      const v1Event = createAwsV1Event({
        httpMethod: 'POST',
        body: base64Body,
        isBase64Encoded: true,
      });

      const rawEvent = Buffer.from(JSON.stringify(v1Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.isBase64Encoded).toBe(true);
      expect(result.body).toBe(base64Body);
    });
  });

  describe('normalizeEvent (v2 - HTTP API)', () => {
    it('should normalize v2 HTTP API event to ServerlessEvent', () => {
      const v2Event: AwsApiGatewayV2Event = {
        version: '2.0',
        routeKey: 'POST /api/users',
        rawPath: '/api/users',
        rawQueryString: 'page=1',
        headers: { 'content-type': 'application/json' },
        queryStringParameters: { page: '1' },
        pathParameters: { id: '123' },
        body: '{"name":"test"}',
        isBase64Encoded: false,
        requestContext: {
          stage: '$default',
          requestId: 'req-abc',
          time: '27/Jul/2026:12:00:00 +0000',
          timeEpoch: 1722072000000,
          http: {
            method: 'POST',
            path: '/api/users',
            protocol: 'HTTP/1.1',
            sourceIp: '10.0.0.1',
            userAgent: 'test-agent',
          },
        },
      };

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.path).toBe('/api/users');
      expect(result.httpMethod).toBe('POST');
      expect(result.body).toBe('{"name":"test"}');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.queryParameters).toEqual({ page: '1' });
      expect(result.pathParameters).toEqual({ id: '123' });
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should extract HTTP method from routeKey in v2 events', () => {
      const v2Event = createAwsV2Event({
        routeKey: 'GET /api/users',
        rawPath: '/api/users',
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.httpMethod).toBe('GET');
    });

    it('should handle v2 event with queryStringParameters from rawQueryString fallback', () => {
      const v2Event = createAwsV2Event({
        rawQueryString: 'foo=bar&baz=qux',
        queryStringParameters: undefined,
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.queryParameters).toEqual({ foo: 'bar', baz: 'qux' });
    });

    it('should handle v2 event with no body', () => {
      const v2Event = createAwsV2Event({
        body: null,
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.body).toBeUndefined();
    });

    it('should handle v2 event without headers (use fallback)', () => {
      const v2Event = createAwsV2Event({
        headers: undefined as unknown as Record<string, string>,
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.headers).toEqual({});
    });

    it('should handle v2 event without pathParameters (use fallback)', () => {
      const v2Event = createAwsV2Event({
        pathParameters: undefined,
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.pathParameters).toEqual({});
    });

    it('should handle v2 event without isBase64Encoded (use fallback)', () => {
      const v2Event = {
        version: '2.0',
        routeKey: 'GET /test',
        rawPath: '/test',
        rawQueryString: '',
        headers: {},
        body: null,
        requestContext: {
          stage: '$default',
          requestId: 'req-abc',
          time: '27/Jul/2026:12:00:00 +0000',
          timeEpoch: 1722072000000,
          http: {
            method: 'GET',
            path: '/test',
            protocol: 'HTTP/1.1',
            sourceIp: '10.0.0.1',
            userAgent: 'test-agent',
          },
        },
      };

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.isBase64Encoded).toBe(false);
    });

    it('should handle v2 event with base64 encoded body', () => {
      const originalBody = 'hello world';
      const base64Body = Buffer.from(originalBody).toString('base64');
      const v2Event = createAwsV2Event({
        body: base64Body,
        isBase64Encoded: true,
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.isBase64Encoded).toBe(true);
      expect(result.body).toBe(base64Body);
    });

    it('should handle v2 event with DELETE method from routeKey', () => {
      const v2Event = createAwsV2Event({
        routeKey: 'DELETE /api/items/1',
        rawPath: '/api/items/1',
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.httpMethod).toBe('DELETE');
    });

    it('should handle v2 event with PATCH method from routeKey', () => {
      const v2Event = createAwsV2Event({
        routeKey: 'PATCH /api/items/1',
        rawPath: '/api/items/1',
      });

      const rawEvent = Buffer.from(JSON.stringify(v2Event));
      const result = provider.normalizeEvent(rawEvent);

      expect(result.httpMethod).toBe('PATCH');
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

    it('should include multiValueHeaders when present', () => {
      const response = {
        statusCode: 200,
        body: 'ok',
        headers: { 'content-type': 'text/plain' },
        isBase64Encoded: false,
        multiValueHeaders: {
          'set-cookie': ['cookie1=val1', 'cookie2=val2'],
        },
      };

      const result = provider.formatResponse(response);

      expect(result.multiValueHeaders).toEqual({
        'set-cookie': ['cookie1=val1', 'cookie2=val2'],
      });
    });
  });

  describe('detect', () => {
    it('should detect AWS context by awsRequestId', () => {
      const rawEvent = Buffer.from(JSON.stringify(createAwsV1Event()));
      const context = createAwsContext();

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect AWS context by invokedFunctionArn', () => {
      const rawEvent = Buffer.from(JSON.stringify(createAwsV1Event()));
      const context = createAwsContext({
        awsRequestId: undefined as unknown as string,
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should detect AWS context by functionName', () => {
      const rawEvent = Buffer.from(JSON.stringify(createAwsV1Event()));
      const context = createAwsContext({
        awsRequestId: undefined as unknown as string,
        invokedFunctionArn: undefined as unknown as string,
      });

      expect(provider.detect(rawEvent, context)).toBe(true);
    });

    it('should not detect non-AWS context (empty object)', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = {};

      expect(provider.detect(rawEvent, context as unknown as AwsLambdaContext)).toBe(false);
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
        logger: { log: () => {} },
      };

      expect(provider.detect(rawEvent, context as unknown as AwsLambdaContext)).toBe(false);
    });

    it('should not detect Tencent context', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = {
        tencentcloud_region: 'ap-guangzhou',
        namespace: 'default',
        tencentcloud_appid: '123456',
      };

      expect(provider.detect(rawEvent, context as unknown as AwsLambdaContext)).toBe(false);
    });

    it('should not detect Volcengine context', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = {
        requestId: 'test-id',
        region: 'cn-beijing',
        accountId: '123456',
        credentials: { accessKeyId: 'key', accessKeySecret: 'secret', securityToken: 'token' },
        function: { memoryMb: 128 },
      };

      expect(provider.detect(rawEvent, context as unknown as AwsLambdaContext)).toBe(false);
    });
  });
});
