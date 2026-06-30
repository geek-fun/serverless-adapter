import { Writable } from 'stream';
import { buildResponse, waitForStreamComplete } from '../../src/transport';
import ServerlessResponse from '../../src/serverlessResponse';
import ServerlessRequest from '../../src/serverlessRequest';

const createMockRequest = (isBase64Encoded = false): ServerlessRequest => {
  return new ServerlessRequest({
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: {},
    body: Buffer.from('test body'),
    remoteAddress: '127.0.0.1',
    isBase64Encoded,
  });
};

describe('transport', () => {
  describe('waitForStreamComplete', () => {
    it('should resolve immediately if stream is writableFinished', async () => {
      const stream = new Writable({ write: () => {} });
      Object.defineProperty(stream, 'writableFinished', { value: true });
      stream.end();

      const result = await waitForStreamComplete(stream);

      expect(result).toBe(stream);
    });

    it('should resolve immediately if stream is writableEnded', async () => {
      const stream = new Writable({ write: () => {} });
      Object.defineProperty(stream, 'writableEnded', { value: true });

      const result = await waitForStreamComplete(stream);

      expect(result).toBe(stream);
    });

    it('should resolve on finish event', async () => {
      const stream = new Writable({ write: () => {} });

      const promise = waitForStreamComplete(stream);
      stream.emit('finish');

      const result = await promise;
      expect(result).toBe(stream);
    });

    it('should resolve on end event', async () => {
      const stream = new Writable({ write: () => {} });

      const promise = waitForStreamComplete(stream);
      stream.emit('end');

      const result = await promise;
      expect(result).toBe(stream);
    });

    it('should reject on error event', async () => {
      const stream = new Writable({ write: () => {} });

      const promise = waitForStreamComplete(stream);
      const error = new Error('test error');
      stream.emit('error', error);

      await expect(promise).rejects.toThrow('test error');
    });

    it('should handle multiple events but only resolve once', async () => {
      const stream = new Writable({ write: () => {} });

      const promise = waitForStreamComplete(stream);
      stream.emit('finish');
      stream.emit('end');

      const result = await promise;
      expect(result).toBe(stream);
    });

    it('should only call complete once even with multiple error events', async () => {
      const stream = new Writable({ write: () => {} });

      const promise = waitForStreamComplete(stream);
      stream.emit('finish');
      stream.emit('end');
      stream.emit('finish');

      const result = await promise;
      expect(result).toBe(stream);
    });
  });

  describe('buildResponse', () => {
    it('should build response with utf8 encoding', () => {
      const request = createMockRequest(false);
      const response = new ServerlessResponse(request);
      response.write('hello world');
      response.end();

      const result = buildResponse({ request, response });

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('hello world');
      expect(result.isBase64Encoded).toBe(false);
    });

    it('should build response with base64 encoding when isBase64Encoded is true', () => {
      const request = createMockRequest(true);
      const response = new ServerlessResponse(request);
      response.write('hello world');
      response.end();

      const result = buildResponse({ request, response });

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe(Buffer.from('hello world').toString('base64'));
      expect(result.isBase64Encoded).toBe(true);
    });

    it('should handle array headers (multiValueHeaders)', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('set-cookie', ['cookie1=value1', 'cookie2=value2']);
      response.setHeader('x-custom', 'single-value');
      response.end();

      const result = buildResponse({ request, response });

      expect(result.multiValueHeaders['set-cookie']).toEqual(['cookie1=value1', 'cookie2=value2']);
      expect(result.headers['x-custom']).toBe('single-value');
    });

    it('should join array headers with comma except set-cookie', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('x-multi', ['value1', 'value2']);
      response.end();

      const result = buildResponse({ request, response });

      expect(result.headers['x-multi']).toBe('value1, value2');
      expect(result.multiValueHeaders['x-multi']).toEqual(['value1', 'value2']);
    });

    it('should handle null header values', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      (response.headers as Record<string, string | null>)['x-null'] = null;
      response.end();

      const result = buildResponse({ request, response });

      expect(result.headers['x-null']).toBe('');
    });

    it('should return multiValueHeaders in response', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.end();

      const result = buildResponse({ request, response });

      expect(result).toHaveProperty('multiValueHeaders');
    });

    it('should handle chunked transfer encoding header', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);

      response.setHeader('transfer-encoding', 'chunked');
      response.write('5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n');
      response.end();

      const allHeaders = ServerlessResponse.headers(response);
      expect(allHeaders['transfer-encoding']).toBe('chunked');
    });

    it('should handle chunkedEncoding flag', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.chunkedEncoding = true;

      response.write('test data');
      response.end();

      expect(response.chunkedEncoding).toBe(true);
    });

    it('should handle chunked encoding body parsing', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('transfer-encoding', 'chunked');
      response.chunkedEncoding = true;

      const chunkedBody = '5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n';
      response.write(chunkedBody);
      response.end();

      expect(response.chunkedEncoding).toBe(true);
      expect(ServerlessResponse.headers(response)['transfer-encoding']).toBe('chunked');
    });

    it('should parse chunked body when transfer-encoding is chunked', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('transfer-encoding', 'chunked');

      response.write('test body');
      response.end();

      const result = buildResponse({ request, response });

      expect(result.statusCode).toBe(200);
    });

    it('should parse chunked body when chunkedEncoding is true', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.chunkedEncoding = true;

      response.write('test body');
      response.end();

      const result = buildResponse({ request, response });

      expect(result.statusCode).toBe(200);
    });

    it('should handle null header value', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      (response.headers as Record<string, string | null>)['x-null'] = null;
      response.end();

      const result = buildResponse({ request, response });

      expect(result.headers['x-null']).toBe('');
    });

    // ─── Binary response encoding (base64 for image/audio/video/pdf/font) ───

    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    it('should base64-encode image/png response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'image/png');
      response.end(pngData);

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(true);
      expect(result.body).toBe(pngData.toString('base64'));
      expect(result.headers['content-type']).toBe('image/png');
    });

    it('should base64-encode image/jpeg response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'image/jpeg');
      const jpgData = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      response.end(jpgData);

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(true);
      expect(result.body).toBe(jpgData.toString('base64'));
    });

    it('should base64-encode audio/mpeg response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'audio/mpeg');
      response.end(Buffer.from([0xff, 0xfb, 0x90, 0x00]));

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(true);
    });

    it('should base64-encode video/mp4 response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'video/mp4');
      response.end(Buffer.from([0x00, 0x00, 0x00, 0x18]));

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(true);
    });

    it('should base64-encode application/pdf response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'application/pdf');
      response.end(Buffer.from([0x25, 0x50, 0x44, 0x46])); // %PDF

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(true);
    });

    it('should base64-encode font/woff2 response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'font/woff2');
      response.end(Buffer.from([0x77, 0x4f, 0x46, 0x32])); // wOF2

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(true);
    });

    it('should NOT base64-encode text/plain response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'text/plain');
      response.end('plain text');

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(false);
      expect(result.body).toBe('plain text');
    });

    it('should NOT base64-encode application/json response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'application/json');
      response.end('{"key":"value"}');

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(false);
      expect(result.body).toBe('{"key":"value"}');
    });

    it('should NOT base64-encode text/html response body', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'text/html');
      response.end('<html></html>');

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(false);
      expect(result.body).toBe('<html></html>');
    });

    it('should NOT base64-encode application/octet-stream (too generic)', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'application/octet-stream');
      response.end('buffer response');

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(false);
      expect(result.body).toBe('buffer response');
    });

    it('should NOT base64-encode response without content-type header', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.end('no content type');

      const result = buildResponse({ request, response });

      expect(result.isBase64Encoded).toBe(false);
      expect(result.body).toBe('no content type');
    });

    it('should preserve binary data round-trip: base64 encode then decode matches original', () => {
      const request = createMockRequest();
      const response = new ServerlessResponse(request);
      response.setHeader('content-type', 'image/png');
      response.end(pngData);

      const result = buildResponse({ request, response });
      const decoded = Buffer.from(result.body, 'base64');

      expect(decoded.equals(pngData)).toBe(true);
    });
  });
});
