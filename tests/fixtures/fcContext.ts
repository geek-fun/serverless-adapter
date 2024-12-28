import { Context, ServerlessEvent } from '../../src/types';

export const defaultEvent: ServerlessEvent = {
  path: '/api/test',
  httpMethod: 'GET',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer sampleToken',
  },
  queryParameters: {
    param1: 'value1',
    param2: 'value2',
  },
  pathParameters: {
    id: '123',
  },
  body: '{"key":"value"}',
  isBase64Encoded: false,
};
export const defaultContext: Context = {
  requestId: 'sample-request-id',
  credentials: {
    accessKeyId: 'sample-access-key-id',
    accessKeySecret: 'sample-access-key-secret',
    securityToken: 'sample-security-token',
  },
  function: {
    name: 'sample-function-name',
    handler: 'sample-function-handler',
    memory: 128,
    timeout: 30,
    initializer: 'sample-initializer',
  },
  service: {
    name: 'sample-service-name',
    logProject: 'sample-log-project',
    logStore: 'sample-log-store',
    qualifier: 'sample-qualifier',
    versionId: 'sample-version-id',
  },
  region: 'sample-region',
  accountId: 'sample-account-id',
  tracing: {
    spanContext: 'sample-span-context',
    jaegerEndpoint: 'sample-jaeger-endpoint',
    spanBaggages: {
      baggage1: 'value1',
      baggage2: 'value2',
    },
    parseOpenTracingBaggages: () => ({
      baggage1: 'value1',
      baggage2: 'value2',
    }),
  },
  logger: {
    debug: (message: string) => console.debug(message),
    info: (message: string) => console.info(message),
    warn: (message: string) => console.warn(message),
    error: (message: string) => console.error(message),
    log: (message: string) => console.log(message),
  },
};
