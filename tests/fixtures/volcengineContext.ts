import { VolcengineVefaasContext, VolcengineApiGatewayEvent } from '../../src/types/volcengine';

export const defaultVolcengineContext: VolcengineVefaasContext = {
  requestId: 'volcengine-request-id-12345',
  credentials: {
    accessKeyId: 'test-access-key-id',
    accessKeySecret: 'test-access-key-secret',
    securityToken: 'test-security-token',
  },
  function: {
    name: 'test-function',
    handler: 'index.handler',
    memoryMb: 128,
    timeout: 30,
  },
  service: {
    logProject: 'test-log-project',
    logStore: 'test-log-store',
    qualifier: '$LATEST',
    versionId: 'v1',
  },
  region: 'cn-beijing',
  accountId: '1234567890',
};

export const defaultVolcengineApiGatewayEvent: VolcengineApiGatewayEvent = {
  path: '/api/test',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  query: {},
  body: '',
  requestContext: {
    requestId: 'req-12345',
    stage: 'release',
    serviceId: 'service-test-id',
  },
};

export const createVolcengineEvent = (
  overrides: Partial<VolcengineApiGatewayEvent> = {},
): VolcengineApiGatewayEvent => ({
  ...defaultVolcengineApiGatewayEvent,
  ...overrides,
});

export const createVolcengineContext = (
  overrides: Partial<VolcengineVefaasContext> = {},
): VolcengineVefaasContext => ({
  ...defaultVolcengineContext,
  ...overrides,
});
