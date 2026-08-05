import { IncomingHttpHeaders } from 'http';

/**
 * Tencent Cloud SCF API Gateway Trigger Event
 * @see https://www.tencentcloud.com/document/product/583/12513
 */
export interface TencentApiGatewayEvent {
  requestContext: {
    serviceId: string;
    path: string;
    httpMethod: string;
    requestId: string;
    identity: {
      secretId?: string;
    };
    sourceIp: string;
    stage: string;
  };
  path: string;
  httpMethod: string;
  queryString: Record<string, string>;
  body: string;
  headers: Record<string, string>;
  pathParameters: Record<string, string>;
  queryStringParameters: Record<string, string>;
  headerParameters: Record<string, string>;
  stageVariables: Record<string, string>;
}

/**
 * Tencent Cloud SCF Function URL (函数 URL) Event for Event Functions
 * Compatible with the API Gateway protocol minus requestContext, pathParameters,
 * queryStringParameters, headerParameters, isBase64Encoded. Query params arrive in `queryString`.
 * @see https://intl.cloud.tencent.com/document/product/583/69491
 */
export interface TencentFunctionUrlEvent {
  body?: string | null;
  headers?: Record<string, string> | null;
  httpMethod: string;
  path?: string | null;
  queryString?: Record<string, string> | null;
}

/**
 * Tencent Cloud SCF Context Object
 * @see https://www.tencentcloud.com/document/product/583/11060
 */
export interface TencentScfContext {
  callbackWaitsForEmptyEventLoop: boolean;
  getRemainingTimeInMillis: () => number;
  memory_limit_in_mb: number;
  time_limit_in_ms: number;
  request_id: string;
  environ: string;
  environment: string;
  function_version: string;
  function_name: string;
  namespace: string;
  tencentcloud_region: string;
  tencentcloud_appid: string;
  tencentcloud_uin: string;
}

/**
 * Tencent Cloud SCF Response for API Gateway Integration
 * @see https://www.tencentcloud.com/document/product/583/12513
 */
export interface TencentScfResponse {
  isBase64Encoded?: boolean;
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
  multiValueHeaders?: { [key: string]: string[] };
}

/**
 * Tencent Cloud SCF Event (Buffer containing JSON)
 */
export type TencentEvent = Buffer;

/**
 * Tencent Cloud SCF Handler Type
 */
export type TencentHandler = (
  event: TencentEvent,
  context: TencentScfContext,
) => Promise<TencentScfResponse>;
