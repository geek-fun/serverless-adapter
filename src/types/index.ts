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
 * Supported cloud providers
 */
export type CloudProvider = 'aliyun' | 'tencent' | 'volcengine' | 'aws';

/**
 * Provider-specific context types
 */
export type ProviderContext =
  | AliyunApiGatewayContext
  | TencentScfContext
  | VolcengineVefaasContext
  | AwsLambdaContext;

/**
 * Provider-specific event types
 */
export type ProviderEvent = AliyunEvent | TencentEvent | VolcengineEvent | AwsEvent;

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
