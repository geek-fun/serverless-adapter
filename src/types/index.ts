import { IncomingHttpHeaders } from 'http';
import { Express } from 'express';
import Application from 'koa';
import { AliyunApiGatewayContext, AliyunEvent, AliyunResponse } from './aliyun';
import {
  TencentApiGatewayEvent,
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

export { AliyunApiGatewayContext, AliyunEvent, AliyunResponse };
export {
  TencentApiGatewayEvent,
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

export type Context = AliyunApiGatewayContext;
export type Event = Buffer;

/**
 * Unified Serverless Event format used internally
 */
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
};

/**
 * Supported cloud providers
 */
export type CloudProvider = 'aliyun' | 'tencent' | 'volcengine';

/**
 * Provider-specific context types
 */
export type ProviderContext = AliyunApiGatewayContext | TencentScfContext | VolcengineVefaasContext;

/**
 * Provider-specific event types
 */
export type ProviderEvent = AliyunEvent | TencentEvent | VolcengineEvent;

export type ServerlessAdapter = (app: Express | Application) => (
  event: Event,
  context: Context,
) => Promise<{
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
  isBase64Encoded: boolean;
}>;
