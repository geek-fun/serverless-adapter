import { IncomingHttpHeaders } from 'http';

/**
 * Volcengine veFaaS API Gateway Trigger Event
 * @see https://www.volcengine.com/docs/6662/116904
 */
export interface VolcengineApiGatewayEvent {
  path: string;
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  requestContext: {
    requestId: string;
    stage: string;
    serviceId: string;
    sourceIp?: string;
  };
}

/**
 * Volcengine veFaaS Context Object
 * @see https://www.volcengine.com/docs/6662/116908
 */
export interface VolcengineVefaasContext {
  requestId: string;
  credentials?: {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
  };
  function?: {
    name: string;
    handler: string;
    memoryMb: number;
    timeout: number;
  };
  service?: {
    logProject: string;
    logStore: string;
    qualifier: string;
    versionId: string;
  };
  region: string;
  accountId: string;
}

/**
 * Volcengine veFaaS Response for API Gateway Integration
 */
export interface VolcengineVefaasResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
}

/**
 * Volcengine veFaaS Event (Buffer containing JSON)
 */
export type VolcengineEvent = Buffer;

/**
 * Volcengine veFaaS Handler Type
 */
export type VolcengineHandler = (
  event: VolcengineEvent,
  context: VolcengineVefaasContext,
) => Promise<VolcengineVefaasResponse>;
