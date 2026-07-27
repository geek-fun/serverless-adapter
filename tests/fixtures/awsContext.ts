import { AwsApiGatewayV1Event, AwsApiGatewayV2Event, AwsLambdaContext } from '../../src/types/aws';

export const defaultAwsContext: AwsLambdaContext = {
  awsRequestId: 'aws-request-id-12345',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  functionName: 'test-function',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2026/07/27/[$LATEST]abc123',
  getRemainingTimeInMillis: () => 3000,
  callbackWaitsForEmptyEventLoop: true,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

export const defaultAwsApiGatewayV1Event: AwsApiGatewayV1Event = {
  path: '/api/test',
  httpMethod: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  queryStringParameters: {},
  pathParameters: {},
  body: null,
  isBase64Encoded: false,
  requestContext: {
    stage: 'dev',
    requestId: 'req-12345',
    identity: {
      sourceIp: '192.168.1.1',
    },
  },
};

export const defaultAwsApiGatewayV2Event: AwsApiGatewayV2Event = {
  version: '2.0',
  routeKey: 'GET /api/test',
  rawPath: '/api/test',
  rawQueryString: '',
  headers: {
    'Content-Type': 'application/json',
  },
  queryStringParameters: {},
  pathParameters: {},
  body: null,
  isBase64Encoded: false,
  requestContext: {
    stage: '$default',
    requestId: 'req-67890',
    time: '27/Jul/2026:12:00:00 +0000',
    timeEpoch: 1722072000000,
    http: {
      method: 'GET',
      path: '/api/test',
      protocol: 'HTTP/1.1',
      sourceIp: '10.0.0.1',
      userAgent: 'test-agent',
    },
  },
};

export const createAwsV1Event = (
  overrides: Partial<AwsApiGatewayV1Event> = {},
): AwsApiGatewayV1Event => ({
  ...defaultAwsApiGatewayV1Event,
  ...overrides,
});

export const createAwsV2Event = (
  overrides: Partial<AwsApiGatewayV2Event> = {},
): AwsApiGatewayV2Event => ({
  ...defaultAwsApiGatewayV2Event,
  ...overrides,
});

export const createAwsContext = (overrides: Partial<AwsLambdaContext> = {}): AwsLambdaContext => ({
  ...defaultAwsContext,
  ...overrides,
});
