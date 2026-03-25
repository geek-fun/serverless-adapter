import { IncomingHttpHeaders } from 'http';

/**
 * Aliyun Function Compute Context
 * @see https://help.aliyun.com/document_detail/426594.html
 */
export type AliyunApiGatewayContext = {
  requestId: string;
  region: string;
  accountId: string;
  credentials: {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
  };
  function: {
    name: string;
    handler: string;
    memory: number;
    timeout: number;
    initializer: string;
  };
  service: {
    name: string;
    logProject: string;
    logStore: string;
    qualifier: string;
    versionId: string;
  };
  tracing: {
    spanContext: string;
    jaegerEndpoint: string;
    spanBaggages: Record<string, string>;
    parseOpenTracingBaggages: () => Record<string, string>;
  };
  logger: {
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    log: (message: string) => void;
  };
};

/**
 * Aliyun Function Compute Event (Buffer containing JSON)
 */
export type AliyunEvent = Buffer;

/**
 * Aliyun Function Compute Response
 */
export interface AliyunResponse {
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
  isBase64Encoded: boolean;
}
