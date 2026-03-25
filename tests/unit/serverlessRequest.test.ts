import ServerlessRequest from '../../src/serverlessRequest';

describe('ServerlessRequest', () => {
  describe('constructor', () => {
    it('should create request with all options', () => {
      const request = new ServerlessRequest({
        method: 'POST',
        url: '/test?foo=bar',
        path: '/test',
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from('{"key":"value"}'),
        remoteAddress: '192.168.1.1',
        isBase64Encoded: false,
      });

      expect(request.method).toBe('POST');
      expect(request.url).toBe('/test?foo=bar');
      expect(request.headers['content-type']).toBe('application/json');
      expect(request.headers['content-length']).toBe('15');
      expect(request.ip).toBe('192.168.1.1');
      expect(request.isBase64Encoded).toBe(false);
    });

    it('should create request with string body', () => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        body: 'string body',
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      expect(request.body).toBe('string body');
    });

    it('should create request with undefined body', () => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        body: undefined,
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      expect(request.body).toBeUndefined();
      expect(request.headers['content-length']).toBe('0');
    });

    it('should lowercase all header keys', () => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: { 'Content-Type': 'text/plain', 'X-Custom-Header': 'value' },
        body: undefined,
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      expect(request.headers['content-type']).toBe('text/plain');
      expect(request.headers['x-custom-header']).toBe('value');
    });

    it('should set HTTP version properties', () => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        body: undefined,
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      expect(request.httpVersion).toBe('1.1');
      expect(request.httpVersionMajor).toBe('1');
      expect(request.httpVersionMinor).toBe('1');
    });

    it('should create mock socket with encrypted property', () => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        body: undefined,
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      expect((request.socket as unknown as Record<string, unknown>).encrypted).toBe(true);
    });

    it('should create mock socket with remoteAddress', () => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        body: undefined,
        remoteAddress: '10.0.0.1',
        isBase64Encoded: false,
      });

      expect(request.socket.remoteAddress).toBe('10.0.0.1');
    });

    it('should create mock socket with address function', () => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        body: undefined,
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      const address = request.socket.address();
      expect(address).toEqual({ port: 443 });
    });

    it('should be a readable stream', (done) => {
      const request = new ServerlessRequest({
        method: 'POST',
        url: '/test',
        path: '/test',
        headers: {},
        body: Buffer.from('request body'),
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on('end', () => {
        expect(Buffer.concat(chunks).toString()).toBe('request body');
        done();
      });
    });

    it('should handle empty body in stream', (done) => {
      const request = new ServerlessRequest({
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        body: undefined,
        remoteAddress: '127.0.0.1',
        isBase64Encoded: false,
      });

      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on('end', () => {
        expect(chunks.length).toBe(0);
        done();
      });
    });
  });
});
