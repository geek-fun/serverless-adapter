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

/**
 * The documented veFaaS API Gateway event structure: `httpMethod` +
 * `queryStringParameters` + `pathParameters`, no `requestContext`.
 *
 * @see https://www.volcengine.com/docs/6662/116914
 */
export const documentedVolcengineApiGatewayEvent: VolcengineApiGatewayEvent = {
  httpMethod: 'GET',
  path: '/api/test',
  pathParameters: { path: 'value' },
  queryStringParameters: { foo: 'bar' },
  headers: {
    Host: '10.243.0.1:9001',
    'User-Agent': 'curl/7.79.1',
    'X-Faas-Request-Id': 'b7e5ac05-cf6a-466a-86d4-093b24c3****',
  },
  body: '{"hello": "veFaaS"}',
};

/** The documented shape, with overrides. */
export const createDocumentedVolcengineEvent = (
  overrides: Partial<VolcengineApiGatewayEvent> = {},
): VolcengineApiGatewayEvent => ({
  ...documentedVolcengineApiGatewayEvent,
  ...overrides,
});

export const createVolcengineContext = (
  overrides: Partial<VolcengineVefaasContext> = {},
): VolcengineVefaasContext => ({
  ...defaultVolcengineContext,
  ...overrides,
});
