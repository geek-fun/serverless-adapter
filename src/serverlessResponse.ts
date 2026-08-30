import { IncomingHttpHeaders, ServerResponse } from 'http';
import { Socket } from 'node:net';
import { debug } from './common';
import ServerlessRequest from './serverlessRequest';

const BODY = Symbol('Response body');
const HEADERS = Symbol('Response headers');

const addData = (stream: ServerlessResponse, data: Buffer | string | Uint8Array): void => {
  try {
    stream[BODY].push(Buffer.from(data));
  } catch (err) {
    debug(`Error adding data to response: ${err}`);
    throw new Error(`response.write() of unexpected type: ${typeof data}`);
  }
};

const isWorkerd = (): boolean =>
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

export const isWorkerdRuntime = isWorkerd;

/**
 * workerd ships a functional ServerResponse (OutgoingMessage → Writable) but stubs
 * assignSocket, which the Node implementation uses to capture the body. The patch
 * must target ServerResponse.prototype — Express swaps res.__proto__ at request
 * time, so subclass-level overrides would be unreachable inside the framework.
 * Idempotent per process, and restorable so test suites sharing the process
 * (jest --runInBand) are not polluted.
 */
export interface WorkerdResponsePatch {
  apply: () => void;
  restore: () => void;
}

let responsePatchApplied = false;

export const createWorkerdResponsePatch = (): WorkerdResponsePatch => {
  return {
    apply: (): void => {
      if (responsePatchApplied) {
        return;
      }
      responsePatchApplied = true;

      const proto = ServerResponse.prototype as unknown as Record<PropertyKey, unknown>;
      const originalWrite = proto.write as (this: unknown, ...args: unknown[]) => boolean;
      const originalEnd = proto.end as (this: unknown, ...args: unknown[]) => unknown;

      const collect = (res: unknown, chunk: unknown): void => {
        const body = (res as Record<PropertyKey, unknown>)[BODY] as Buffer[] | undefined;
        if (!body) {
          return;
        }
        // workerd's Buffer is a view over a pooled store consumed by OutgoingMessage;
        // snapshot immediately or the captured body is recycled before buildResponse runs
        const isBuf = Buffer.isBuffer(chunk);
        const buf = isBuf ? Buffer.from(chunk as Buffer) : Buffer.from(String(chunk));
        body.push(buf);
      };

      proto.write = function (this: Record<PropertyKey, unknown>, ...args: unknown[]): boolean {
        collect(this, args[0]);
        return originalWrite.apply(this, args);
      };

      proto.end = function (this: Record<PropertyKey, unknown>, ...args: unknown[]): unknown {
        if (args[0]) {
          collect(this, args[0]);
        }
        const result = originalEnd.apply(this, args);
        if ((this as Record<PropertyKey, unknown>)[BODY]) {
          (this as unknown as { emit: (event: string) => void }).emit('finish');
        }
        return result;
      };
    },
    restore: (): void => {
      if (!responsePatchApplied) {
        return;
      }
      const proto = ServerResponse.prototype as unknown as Record<PropertyKey, unknown>;
      delete proto.write;
      delete proto.end;
      responsePatchApplied = false;
    },
  };
};

const workerdResponsePatch = createWorkerdResponsePatch();

if (isWorkerd()) {
  workerdResponsePatch.apply();
}

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
    // workerd's OutgoingMessage.setHeader throws once headersSent, so late headers
    // (e.g. set after writeHead) must land in the adapter-side [HEADERS] store
    const sent = isWorkerdRuntime() ? this.headersSent : this._wroteHeader;

    if (sent) {
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

    this[HEADERS] = {};
    this._header = '';
    this.useChunkedEncodingByDefault = false;
    this.chunkedEncoding = false;

    if (isWorkerd()) {
      // assignSocket is a stub on workerd; the patched prototype captures output instead.
      // [BODY] existing as an own property is also the patch's capture marker — Node-path
      // instances must NOT have it, or the patch would double-collect on top of addData.
      this[BODY] = [];
      return;
    }

    this[BODY] = [];

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
          // Detect HTTP header boundary in raw bytes to preserve binary body data.
          // Using Buffer.indexOf avoids corrupting bytes >= 0x80 (which would
          // become U+FFFD if converted to string via getString()).
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          const headerEndBuf = Buffer.from('\r\n\r\n');
          const index = buf.indexOf(headerEndBuf);

          if (index !== -1) {
            // Combined header + body (text response case)
            const remainder = buf.subarray(index + headerEndBuf.length);
            if (remainder.length > 0) {
              addData(this, remainder);
            }
            this._wroteHeader = true;
          } else {
            // Body data only — header already written separately
            // (or binary body in Node.js 20+ where header is in outputData)
            addData(this, data);
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
