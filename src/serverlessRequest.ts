// ATTRIBUTION: https://github.com/dougmoscrop/serverless-http

import { IncomingMessage } from 'http';
import { Socket } from 'net';

const HTTPS_PORT = 443;

interface ServerlessRequestOptions {
  method: string;
  url: string;
  headers: { [key: string]: string | number };
  body: Buffer | string;
  remoteAddress: string;
  isBase64Encoded: boolean;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NO_OP: (...args: any[]) => any = () => void 0;

export default class ServerlessRequest extends IncomingMessage {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  ip: string;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  body: Buffer | string;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
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
        'content-length': Buffer.byteLength(body).toString(),
      }).map(([key, value]) => [key.toLowerCase(), value]),
    );

    Object.assign(this, {
      ip: remoteAddress,
      complete: true,
      httpVersion: '1.1',
      httpVersionMajor: '1',
      httpVersionMinor: '1',
      method,
      body,
      url,
      headers: combinedHeaders,
      isBase64Encoded,
    });

    this._read = () => {
      this.push(body);
      this.push(null);
    };
  }
}
