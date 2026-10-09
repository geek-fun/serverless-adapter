import { IncomingHttpHeaders } from 'http';

/**
 * Volcengine veFaaS API Gateway Trigger Event.
 *
 * The platform sends `httpMethod`, `pathParameters` and `queryStringParameters`;
 * the legacy `method` / `query` / `requestContext` spellings are kept alongside
 * them because deployments created against the older integration still deliver
 * those, and because the fixtures this adapter was originally written for use
 * them.
 *
 * @see https://www.volcengine.com/docs/6662/116904
 */
export interface VolcengineApiGatewayEvent {
  path: string;
  /** Request method, as documented. */
  httpMethod?: string;
  /** Legacy request-method spelling. */
  method?: string;
  headers: Record<string, string>;
  /** Query parameters, as documented. */
  queryStringParameters?: Record<string, string>;
  /** Legacy query-parameter spelling. */
  query?: Record<string, string>;
  /** Path parameters, as documented. */
  pathParameters?: Record<string, string>;
  body: string;
  /** Present on the legacy integration only. */
  requestContext?: {
    requestId: string;
    stage: string;
    serviceId: string;
    sourceIp?: string;
  };
}

/**
 * Volcengine veFaaS Timer trigger event — a CloudEvents envelope whose `source`
 * is `/faas/event/timer/{timer_id}` and whose `data` carries the configured
 * trigger message (Trigger Message).
 *
 * @see https://www.volcengine.com/docs/6662/116914
 */
export interface VolcengineTimerEvent {
  id?: string;
  source?: string;
  specversion?: string;
  /** ISO 8601 trigger time. */
  time?: string;
  type: 'faas.timer.event';
  datacontenttype?: string;
  /** The trigger message; delivered as a string (`application/octet-stream`). */
  data?: unknown;
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
  multiValueHeaders?: { [key: string]: string[] };
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
