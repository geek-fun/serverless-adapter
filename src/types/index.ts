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
  VolcengineTimerEvent,
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
  VolcengineTimerEvent,
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
 * What an HTTP invocation answers with: the API-Gateway style response envelope.
 */
export type ServerlessHandlerResult = ServerlessResponse;

/**
 * The handler the adapter returns.
 *
 * `Result` is `ServerlessHandlerResult` for HTTP-only apps, and `unknown` once
 * `events` handlers are configured: a timer / queue invocation has no HTTP
 * response contract, so the handler's return value is passed through verbatim.
 */
export type ServerlessHandler<Result = ServerlessHandlerResult> = (
  event: ProviderEvent,
  context: ProviderContext,
) => Promise<Result>;

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
 * Normalized timer invocation — the same shape for every provider (issue #23).
 * Built by `normalizeTimerEvent` from the platform envelope and delivered to
 * `events.timer`.
 */
export type TimerEvent = {
  /** Informational (logs / telemetry); never a dispatch key. */
  provider: CloudProvider;
  triggerName?: string;
  triggerTime?: string;
  /** JSON-parsed when parseable, otherwise the raw string. */
  payload?: unknown;
  /** The untouched platform event — never lose information. */
  raw: unknown;
};

/**
 * Handler for positively identified timer invocations. Its return value is
 * passed through verbatim — timer invocations have no HTTP response contract,
 * so it is never wrapped into a fake `statusCode`/`body`.
 */
export type TimerEventHandler = (
  event: TimerEvent,
  context: ProviderContext,
) => unknown | Promise<unknown>;

/**
 * Handler for invocations positively identified as non-HTTP but not timers
 * (queue events, object-storage notifications, …). Receives the raw platform
 * event untouched; the return value is passed through verbatim.
 */
export type NonHttpEventHandler = (
  raw: unknown,
  context: ProviderContext,
) => unknown | Promise<unknown>;

/**
 * Non-HTTP handlers, the sibling of `provider` (issue #23): one deployment
 * targets one cloud, so handlers are keyed by event kind, not by provider.
 */
export type EventHandlers = {
  timer?: TimerEventHandler;
  nonHttp?: NonHttpEventHandler;
};

/**
 * A web framework application accepted by the adapter. Express is a function,
 * Koa exposes `.callback`, Hono exposes `.fetch`.
 */
export type FrameworkApp = Express | Application | HonoApp;

/**
 * The `events` option of the symmetric entrypoint form, which additionally
 * carries the HTTP app: `serverlessAdapter({ provider, events: { http, timer } })`.
 */
export type EventHandlersWithHttp = EventHandlers & { http: FrameworkApp };

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

/**
 * @deprecated Describes only the positional, HTTP-only form. Use the overloads of
 * `serverlessAdapter` (or `ServerlessHandler<Result>` directly) — this alias
 * predates the symmetric entrypoint form and the non-HTTP `events` handlers.
 */
export type ServerlessAdapter = (app: Express | Application | HonoApp) => ServerlessHandler;
