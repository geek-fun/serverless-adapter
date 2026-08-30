import { IncomingHttpHeaders } from 'http';

/**
 * Cloudflare Workers fetch handler context (ExecutionContext)
 * @see https://developers.cloudflare.com/workers/runtime-apis/context/
 */
export type CloudflareWorkerContext = {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
};

/**
 * Cloudflare Workers event — the raw web standard Request delivered to the fetch handler
 */
export type CloudflareEvent = Request;

/**
 * Cloudflare Workers response — the Worker entrypoint converts this to a web standard Response
 */
export interface CloudflareResponse {
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
  isBase64Encoded: boolean;
  multiValueHeaders?: { [key: string]: string[] };
}
