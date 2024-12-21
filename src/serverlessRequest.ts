import { IncomingMessage } from 'http';
import { Socket } from 'net';

const HTTPS_PORT = 443;

interface ServerlessRequestOptions {
  method: string;
  url: string;
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

  constructor({
    method,
    url,
    headers,
    body,
    remoteAddress,
    isBase64Encoded,
  }: ServerlessRequestOptions) {
    super({
      encrypted: true,
      readable: false,
      remoteAddress,
      address: () => ({ port: HTTPS_PORT }),
      end: NO_OP,
      destroy: NO_OP,
    } as unknown as Socket);

    const combinedHeaders = Object.fromEntries(
      Object.entries({
        ...headers,
        'content-length': Buffer.byteLength(body ?? '').toString(),
      }).map(([key, value]) => [key.toLowerCase(), value]),
    );

    Object.assign(this, {
      complete: true,
      httpVersion: '1.1',
      httpVersionMajor: '1',
      httpVersionMinor: '1',
      method,
      url,
      headers: combinedHeaders,
    });

    this.body = body;
    this.ip = remoteAddress;
    this.isBase64Encoded = isBase64Encoded;

    this._read = () => {
      this.push(body);
      this.push(null);
    };
  }
}
