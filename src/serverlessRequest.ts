import { IncomingMessage } from 'http';
import { Socket } from 'net';

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

export default class ServerlessRequest extends IncomingMessage {
  ip: string;

  body: Buffer | string | undefined;

  isBase64Encoded: boolean;

  constructor(request: ServerlessRequestOptions) {
    super({
      encrypted: true,
      readable: false,
      remoteAddress: request.remoteAddress,
      address: () => ({ port: HTTPS_PORT }),
      end: NO_OP,
      destroy: NO_OP,
      path: request.path,
      headers: request.headers,
    } as unknown as Socket);

    const combinedHeaders = Object.fromEntries(
      Object.entries({
        ...request.headers,
        'content-length': Buffer.byteLength(request.body ?? '').toString(),
      }).map(([key, value]) => [key.toLowerCase(), value]),
    );

    Object.assign(this, {
      ...request,
      complete: true,
      httpVersion: '1.1',
      httpVersionMajor: '1',
      httpVersionMinor: '1',
      headers: combinedHeaders,
    });

    this.body = request.body;
    this.ip = request.remoteAddress;
    this.isBase64Encoded = request.isBase64Encoded;

    this._read = () => {
      this.push(request.body);
      this.push(null);
    };
  }
}
