import { TencentScfContext, TencentApiGatewayEvent } from '../../src/types/tencent';

export const defaultTencentContext: TencentScfContext = {
  callbackWaitsForEmptyEventLoop: true,
  getRemainingTimeInMillis: () => 3000,
  memory_limit_in_mb: 128,
  time_limit_in_ms: 3000,
  request_id: 'test-request-id-12345',
  environ: '{"SCF_NAMESPACE":"default"}',
  environment: '{"SCF_NAMESPACE":"default"}',
  function_version: '$LATEST',
  function_name: 'test-function',
  namespace: 'default',
  tencentcloud_region: 'ap-guangzhou',
  tencentcloud_appid: '1234567890',
  tencentcloud_uin: '100012345678',
};

export const defaultTencentApiGatewayEvent: TencentApiGatewayEvent = {
  requestContext: {
    serviceId: 'service-test-id',
    path: '/api/test',
    httpMethod: 'GET',
    requestId: 'req-12345',
    identity: {
      secretId: 'test-secret-id',
    },
    sourceIp: '192.168.1.1',
    stage: 'release',
  },
  path: '/api/test',
  httpMethod: 'GET',
  queryString: {},
  body: '',
  headers: {
    'Content-Type': 'application/json',
  },
  pathParameters: {},
  queryStringParameters: {},
  headerParameters: {},
  stageVariables: {},
};

export const createTencentEvent = (
  overrides: Partial<TencentApiGatewayEvent> = {},
): TencentApiGatewayEvent => ({
  ...defaultTencentApiGatewayEvent,
  ...overrides,
});

export const createTencentContext = (
  overrides: Partial<TencentScfContext> = {},
): TencentScfContext => ({
  ...defaultTencentContext,
  ...overrides,
});
