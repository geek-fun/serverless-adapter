import { IncomingHttpHeaders } from 'http';
import { Express } from 'express';
import Application from 'koa';
import { AliyunApiGatewayContext, AliyunEvent, AliyunResponse } from './aliyun';
import {
  TencentApiGatewayEvent,
  TencentFunctionUrlEvent,
  TencentScfContext,
  TencentScfResponse,
  TencentEvent,
  TencentHandler,
} from './tencent';
import {
  VolcengineApiGatewayEvent,
  VolcengineVefaasContext,
  VolcengineVefaasResponse,
  VolcengineEvent,
  VolcengineHandler,
} from './volcengine';
import {
  AwsApiGatewayV1Event,
  AwsApiGatewayV2Event,
  AwsLambdaContext,
  AwsResponse,
  AwsEvent,
  AwsHandler,
} from './aws';
import { CloudflareEvent, CloudflareResponse, CloudflareWorkerContext } from './cloudflare';

export { AliyunApiGatewayContext, AliyunEvent, AliyunResponse };
export {
  TencentApiGatewayEvent,
  TencentFunctionUrlEvent,
  TencentScfContext,
  TencentScfResponse,
  TencentEvent,
  TencentHandler,
};
export {
  VolcengineApiGatewayEvent,
  VolcengineVefaasContext,
  VolcengineVefaasResponse,
  VolcengineEvent,
  VolcengineHandler,
};
export {
  AwsApiGatewayV1Event,
  AwsApiGatewayV2Event,
  AwsLambdaContext,
  AwsResponse,
  AwsEvent,
  AwsHandler,
};
export { CloudflareEvent, CloudflareResponse, CloudflareWorkerContext };

export type Context = AliyunApiGatewayContext;
export type Event = Buffer;

/**
 * Unified Serverless Event format used internally
 */
/**
 * Minimal interface for Hono app detection via duck-typing
 */
export type HonoApp = { fetch: (request: Request) => Response | Promise<Response> };

export type ServerlessEvent = {
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  queryParameters: Record<string, string>;
  pathParameters: Record<string, string>;
  body: string | Buffer | Record<string, unknown> | unknown;
  isBase64Encoded: boolean;
};

/**
 * Unified Serverless Response format
 */
export type ServerlessResponse = {
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
  isBase64Encoded: boolean;
  multiValueHeaders?: { [key: string]: string[] };
};

/**
 * What kind of invocation the provider received.
 *
 * `http` is the only kind this adapter can answer: API Gateway / Function URL /
 * fetch invocations are normalized into a request for the web framework.
 * `timer` and `unknown` (queue events, object storage notifications, …) have no
 * HTTP request to build and no HTTP response contract to satisfy — dispatching
 * them into the app silently answers a request nobody made (issue #22).
 */
export type EventKind = 'http' | 'timer' | 'unknown';

/**
 * Result of classifying a raw invocation before it is normalized.
 */
export interface EventClassification {
  kind: EventKind;
  /** Provider-specific hint for logs and error messages (e.g. the timer trigger name). */
  detail?: string;
}

/**
 * Supported cloud providers
 */
export type CloudProvider = 'aliyun' | 'tencent' | 'volcengine' | 'aws' | 'cloudflare';

/**
 * Provider-specific context types
 */
export type ProviderContext =
  | AliyunApiGatewayContext
  | TencentScfContext
  | VolcengineVefaasContext
  | AwsLambdaContext
  | CloudflareWorkerContext;

/**
 * Provider-specific event types
 */
export type ProviderEvent =
  | AliyunEvent
  | TencentEvent
  | VolcengineEvent
  | AwsEvent
  | CloudflareEvent;

export type ServerlessAdapter = (app: Express | Application | HonoApp) => (
  event: Event,
  context: Context,
) => Promise<{
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
  isBase64Encoded: boolean;
  multiValueHeaders?: { [key: string]: string[] };
}>;
