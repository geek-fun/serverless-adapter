import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import serverlessAdapter from '../src';
import { Event, Context } from '../src/types';

describe('unit test for index', function () {
  it('should pass test', function () {
    expect(true).toBe(true);
  });
});
const defaultEvent: Event = {
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
const defaultContext: Context = {
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
describe('express', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it('basic middleware should set statusCode and default body', async () => {
    app.use((req: Request, res: Response) => {
      res.status(418).send(`I'm a teapot`);
    });

    const response = await serverlessAdapter(app)(defaultEvent, defaultContext);
    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual(`I'm a teapot`);
  });

  it('basic middleware should get text body', async () => {
    app.use(bodyParser.text());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body);
    });
    const response = await serverlessAdapter(app)(
      {
        ...defaultEvent,
        httpMethod: 'GET',
        body: 'hello, world',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': '12',
        },
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('hello, world');
  });

  it('basic middleware should get json body', async () => {
    app.use(bodyParser.json());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body.hello);
    });

    const response = await serverlessAdapter(app)(
      {
        ...defaultEvent,
        httpMethod: 'GET',
        body: JSON.stringify({
          hello: 'world',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('world');
  });

  it('basic middleware should get query params', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.query.foo as string);
    });

    const response = await serverlessAdapter(app)(
      {
        ...defaultEvent,
        httpMethod: 'GET',
        path: '/',
        queryParameters: {
          foo: 'bar',
        },
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('bar');
  });

  it('should match verbs', async () => {
    app.get('/', (req: Request, res: Response) => {
      res.status(200).send('foo');
    });
    app.put('/', (req: Request, res: Response) => {
      res.status(201).send('bar');
    });

    const response = await serverlessAdapter(app)(
      {
        ...defaultEvent,
        httpMethod: 'GET',
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual('bar');
  });

  it('should serve files', async () => {
    app.use(express.static('test'));

    const response = await serverlessAdapter(app)(
      {
        ...defaultEvent,
        httpMethod: 'GET',
        path: '/file.txt',
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('this is a test\n');
  });

  it('destroy weird', async () => {
    app.use((req: Request, res: Response) => {
      // this was causing a .destroy is not a function error
      res.send('test');
      res.json({ test: 'test' });
    });

    const response = await serverlessAdapter(app)(
      {
        ...defaultEvent,
        httpMethod: 'GET',
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('test');
  });
});
