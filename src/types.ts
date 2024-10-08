import { Express } from 'express';

type AliyunApiGatewayEvent = {
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  queryParameters: Record<string, string>;
  pathParameters: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
};

type AliyunApiGatewayContext = {
  requestId: string;
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
  };
  region: string;
  accountId: string;
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

export type Event = AliyunApiGatewayEvent;

export type Context = AliyunApiGatewayContext;

export type ServerlessAdapter = (
  app: Express,
) => (event: Event, context: Context) => Promise<{ statusCode: number; body: unknown }>;
