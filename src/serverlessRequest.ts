// ATTRIBUTION: https://github.com/dougmoscrop/serverless-http

import { IncomingMessage } from 'http';
import { Socket } from 'net';

const HTTPS_PORT = 443;

interface ServerlessRequestOptions {
  method: string;
  url: string;
  headers: { [key: string]: string };
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

    // IncomingMessage has a lot of logic for when to lowercase or alias well-known header names,
    // so we delegate to that logic here
    const headerEntries = Object.entries(headers);
    const rawHeaders = new Array(headerEntries.length * 2);
    for (let i = 0; i < headerEntries.length; i++) {
      rawHeaders[i * 2] = headerEntries[i][0];
      rawHeaders[i * 2 + 1] = headerEntries[i][1];
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this._addHeaderLines(rawHeaders, rawHeaders.length);

    Object.assign(this, {
      ip: remoteAddress,
      complete: true,
      httpVersion: '1.1',
      httpVersionMajor: '1',
      httpVersionMinor: '1',
      method,
      body,
      url,
      isBase64Encoded,
    });

    this._read = () => {
      this.push(body);
      this.push(null);
    };
  }
}
