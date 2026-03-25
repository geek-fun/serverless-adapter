import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { Duplex } from 'stream';

const HTTPS_PORT = 443;

interface ServerlessRequestOptions {
  method: string;
  url: string;
  path: string;
  headers: { [key: string]: string | number };
  body: Buffer | string | undefined;
  remoteAddress: string;
  isBase64Encoded: boolean;
}

const NO_OP: (...args: unknown[]) => unknown = () => void 0;

const createMockSocket = (remoteAddress: string) => {
  const stream = new Duplex({
    read() {},
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  return Object.assign(stream, {
    encrypted: true,
    readable: true,
    remoteAddress,
    address: () => ({ port: HTTPS_PORT }),
    end: NO_OP,
    destroy: NO_OP,
  }) as unknown as Socket;
};

export default class ServerlessRequest extends IncomingMessage {
  ip: string;

  body: Buffer | string | undefined;

  isBase64Encoded: boolean;

  constructor(request: ServerlessRequestOptions) {
    super(createMockSocket(request.remoteAddress));

    const combinedHeaders = Object.fromEntries(
      Object.entries({
        ...request.headers,
        'content-length': Buffer.byteLength(request.body ?? '').toString(),
      }).map(([key, value]) => [key.toLowerCase(), value]),
    );

    Object.assign(this, {
      ...request,
      httpVersion: '1.1',
      httpVersionMajor: '1',
      httpVersionMinor: '1',
      headers: combinedHeaders,
    });

    this.body = request.body;
    this.ip = request.remoteAddress;
    this.isBase64Encoded = request.isBase64Encoded;

    let bodyPushed = false;
    this._read = () => {
      if (!bodyPushed) {
        bodyPushed = true;
        if (request.body) {
          this.push(request.body);
        }
        this.push(null);
      }
    };
  }
}
