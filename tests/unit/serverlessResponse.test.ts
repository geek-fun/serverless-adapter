import ServerlessResponse from '../../src/serverlessResponse';
import ServerlessRequest from '../../src/serverlessRequest';

const createMockRequest = (body?: Buffer): ServerlessRequest => {
  return new ServerlessRequest({
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: { 'content-type': 'application/json' },
    body: body ?? Buffer.from(''),
    remoteAddress: '127.0.0.1',
    isBase64Encoded: false,
  });
};

describe('ServerlessResponse', () => {
  describe('constructor', () => {
    it('should create response with empty body and headers', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      expect(response.statusCode).toBe(200);
      expect(ServerlessResponse.body(response)).toEqual(Buffer.from(''));
    });

    it('should handle write with string data', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.write('hello world');
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('hello world');
    });

    it('should handle write with Buffer data', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.write(Buffer.from('buffer data'));
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('buffer data');
    });

    it('should handle write with Uint8Array data', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      const encoder = new TextEncoder();
      response.write(encoder.encode('uint8array data'));
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('uint8array data');
    });

    it('should handle write with encoding as function callback', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      let callbackCalled = false;
      response.write('test data', () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(true);
    });

    it('should handle write with encoding and callback', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      let callbackCalled = false;
      response.write('test data', 'utf8', () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(true);
    });

    it('should throw error for unexpected write type via addData', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'text/plain');
      response.writeHead(200);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => (response as any).socket.write({})).toThrow(
        'response.write() of unexpected type: object',
      );
    });
  });

  describe('static from', () => {
    it('should create response from request with body', () => {
      const request = createMockRequest(Buffer.from('request body'));
      (request as unknown as Record<string, unknown>).statusCode = 201;
      (request as unknown as Record<string, unknown>).headers = { 'x-custom': 'value' };

      const response = ServerlessResponse.from(request);

      expect(response.statusCode).toBe(201);
      expect(ServerlessResponse.body(response).toString()).toBe('request body');
    });

    it('should create response from request without body', () => {
      const request = createMockRequest();
      (request as unknown as Record<string, unknown>).statusCode = 200;

      const response = ServerlessResponse.from(request);

      expect(response.statusCode).toBe(200);
      expect(ServerlessResponse.body(response)).toEqual(Buffer.from(''));
    });
  });

  describe('static body', () => {
    it('should return concatenated body buffers', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.write('part1');
      response.write('part2');
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('part1part2');
    });
  });

  describe('static headers', () => {
    it('should return headers using getHeaders method', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'application/json');

      const headers = ServerlessResponse.headers(response);

      expect(headers['content-type']).toBe('application/json');
    });

    it('should merge with symbol headers', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('x-custom', 'value');

      const headers = ServerlessResponse.headers(response);

      expect(headers['x-custom']).toBe('value');
    });
  });

  describe('get headers', () => {
    it('should return symbol headers', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      expect(response.headers).toEqual({});
    });
  });

  describe('setHeader', () => {
    it('should set header via super when not wroteHeader', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.setHeader('content-type', 'text/plain');

      expect(response.getHeader('content-type')).toBe('text/plain');
    });

    it('should set header to symbol headers when wroteHeader is true', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('test');
      response.setHeader('x-after-write', 'value');

      expect(response.headers['x-after-write']).toBe('value');
    });

    it('should return this for chaining', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      const result = response.setHeader('x-test', 'value');

      expect(result).toBe(response);
    });
  });

  describe('writeHead', () => {
    it('should write head with status code only', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.writeHead(201);

      expect(response.statusCode).toBe(201);
    });

    it('should write head with status code and reason phrase', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.writeHead(201, 'Created');

      expect(response.statusCode).toBe(201);
    });

    it('should write head with status code and headers object', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.writeHead(201, { 'x-custom': 'value', 'content-type': 'application/json' });

      expect(response.statusCode).toBe(201);
      expect(response.getHeader('x-custom')).toBe('value');
    });

    it('should write head with status code, reason phrase, and headers', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.writeHead(201, 'Created', { 'x-custom': 'value' });

      expect(response.statusCode).toBe(201);
      expect(response.getHeader('x-custom')).toBe('value');
    });

    it('should return this for chaining', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      const result = response.writeHead(200);

      expect(result).toBe(response);
    });

    it('should break after first header when not wroteHeader', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.writeHead(200, { 'x-first': 'first', 'x-second': 'second' });

      expect(response.getHeader('x-first')).toBe('first');
    });
  });

  describe('getString helper (via write)', () => {
    it('should handle Buffer data', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.write(Buffer.from('buffer content'));
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('buffer content');
    });

    it('should handle string data', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.write('string content');
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('string content');
    });

    it('should handle Uint8Array data', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.write(new TextEncoder().encode('uint8 content'));
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('uint8 content');
    });

    it('should throw error for unexpected type in getString', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => (response as any).socket.write(123)).toThrow(
        'response.write() of unexpected type: number',
      );
    });

    it('should handle Uint8Array in getString', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      const uint8Array = new Uint8Array([104, 101, 108, 108, 111]);
      response.write(uint8Array);
      response.end();

      expect(ServerlessResponse.body(response).toString()).toBe('hello');
    });
  });
});
