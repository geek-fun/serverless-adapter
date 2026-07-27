import { IncomingHttpHeaders } from 'http';

/**
 * API Gateway v1 (REST API) Event
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
 */
export interface AwsApiGatewayV1Event {
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext: {
    stage: string;
    requestId: string;
    identity: {
      sourceIp?: string;
    };
    [key: string]: unknown;
  };
  multiValueHeaders?: Record<string, string[]>;
  multiValueQueryStringParameters?: Record<string, string[]>;
  stageVariables?: Record<string, string>;
}

/**
 * API Gateway v2 (HTTP API) Event
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
 */
export interface AwsApiGatewayV2Event {
  version: '2.0';
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext: {
    stage: string;
    requestId: string;
    time: string;
    timeEpoch: number;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    [key: string]: unknown;
  };
  stageVariables?: Record<string, string>;
  cookies?: string[];
}

/**
 * AWS Lambda Context Object
 * @see https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
 */
export interface AwsLambdaContext {
  awsRequestId: string;
  invokedFunctionArn: string;
  functionName: string;
  memoryLimitInMB: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis: () => number;
  callbackWaitsForEmptyEventLoop: boolean;
  done: (error?: Error, result?: unknown) => void;
  fail: (error: Error | string) => void;
  succeed: (result: unknown) => void;
  identity?: {
    cognitoIdentityId: string;
    cognitoIdentityPoolId: string;
  };
  clientContext?: {
    client: {
      installation_id: string;
      app_title: string;
      app_version_name: string;
      app_version_code: string;
      app_package_name: string;
    };
    env: {
      platform_version: string;
      platform: string;
      make: string;
      model: string;
      locale: string;
    };
    Custom: unknown;
  };
}

/**
 * AwsEvent is a Buffer containing JSON (like other providers)
 */
export type AwsEvent = Buffer;

/**
 * AWS Response for API Gateway integration
 */
export interface AwsResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
  isBase64Encoded: boolean;
  multiValueHeaders?: { [key: string]: string[] };
}

/**
 * AWS Lambda Handler Type
 */
export type AwsHandler = (event: AwsEvent, context: AwsLambdaContext) => Promise<AwsResponse>;
