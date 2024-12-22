import { IncomingHttpHeaders, ServerResponse } from 'http';
import { Socket } from 'node:net';
import { debug } from './common';
import ServerlessRequest from './serverlessRequest';

const headerEnd = '\r\n\r\n';

const BODY = Symbol('Response body');
const HEADERS = Symbol('Response headers');

const getString = (data: unknown): string => {
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  } else if (typeof data === 'string') {
    return data;
  } else if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  } else {
    throw new Error(`response.write() of unexpected type: ${typeof data}`);
  }
};

const addData = (stream: ServerlessResponse, data: Buffer | string | Uint8Array): void => {
  try {
    stream[BODY].push(Buffer.from(data));
  } catch (err) {
    debug(`Error adding data to response: ${err}`);
    throw new Error(`response.write() of unexpected type: ${typeof data}`);
  }
};

export default class ServerlessResponse extends ServerResponse {
  private _wroteHeader = false;
  private _header: string;

  [BODY]: Buffer[];
  [HEADERS]: IncomingHttpHeaders;

  static from(res: ServerlessRequest): ServerlessResponse {
    const response = new ServerlessResponse(res);
    const { statusCode = 0, headers, body } = res;
    response.statusCode = statusCode;
    response[HEADERS] = headers;
    response[BODY] = body ? [Buffer.from(body)] : [];
    response.end();

    return response;
  }

  static body(res: ServerlessResponse): Buffer {
    return Buffer.concat(res[BODY]);
  }

  static headers(res: ServerlessResponse): IncomingHttpHeaders {
    const headers = typeof res.getHeaders === 'function' ? res.getHeaders() : res.headers;

    return Object.assign(headers, res[HEADERS]);
  }

  get headers(): IncomingHttpHeaders {
    return this[HEADERS];
  }

  setHeader(name: string, value: string | number | readonly string[]) {
    if (this._wroteHeader) {
      this[HEADERS][name] = value as string;
    } else {
      super.setHeader(name, value);
    }
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  writeHead(statusCode: number, reason?: string | IncomingHttpHeaders, obj?: IncomingHttpHeaders) {
    const headers = typeof reason === 'string' ? obj : (reason as IncomingHttpHeaders);

    for (const name in headers) {
      this.setHeader(name, headers[name] as string);

      if (!this._wroteHeader) {
        // we only need to initiate super.headers once
        // writeHead will add the other headers itself
        break;
      }
    }

    super.writeHead(statusCode, reason as string, obj);
    return this;
  }

  constructor(request: ServerlessRequest) {
    super(request);

    this[BODY] = [];
    this[HEADERS] = {};

    this.useChunkedEncodingByDefault = false;
    this.chunkedEncoding = false;
    this._header = '';

    this.assignSocket({
      _writableState: {},
      writable: true,
      on: Function.prototype,
      removeListener: Function.prototype,
      destroy: Function.prototype,
      cork: Function.prototype,
      uncork: Function.prototype,
      write: (data: Buffer | string | Uint8Array, encoding?: string | null, cb?: () => void) => {
        if (typeof encoding === 'function') {
          cb = encoding;
          encoding = null;
        }

        if (this._header === '' || this._wroteHeader) {
          addData(this, data);
        } else {
          const string = getString(data);
          const index = string.indexOf(headerEnd);

          if (index !== -1) {
            const remainder = string.slice(index + headerEnd.length);

            if (remainder) {
              addData(this, remainder);
            }

            this._wroteHeader = true;
          }
        }

        if (typeof cb === 'function') {
          cb();
        }
      },
    } as unknown as Socket);
  }
}
