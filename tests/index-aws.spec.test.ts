import express, { Express, Request, Response } from 'express4';
import bodyParser from 'body-parser';
import { createAwsContext, createAwsV1Event, createAwsV2Event } from './fixtures/awsContext';
import { sendRequest } from './fixtures/requestHelper';

describe('AWS Lambda + API Gateway with Express 4.x', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  describe('API Gateway v1 (REST API)', () => {
    it('basic middleware should set statusCode and default body', async () => {
      app.use((req: Request, res: Response) => {
        res.status(418).send(`I'm a teapot`);
      });

      const response = await sendRequest(
        app,
        createAwsV1Event() as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );
      expect(response.statusCode).toEqual(418);
      expect(response.body).toEqual(`I'm a teapot`);
    });

    it('basic middleware should get json body', async () => {
      app.use(bodyParser.json());
      app.use((req: Request, res: Response) => {
        res.status(200).send(req.body.hello);
      });

      const response = await sendRequest(
        app,
        createAwsV1Event({
          httpMethod: 'POST',
          body: JSON.stringify({ hello: 'world' }),
          headers: { 'Content-Type': 'application/json' },
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual('world');
    });

    it('basic middleware should get query params', async () => {
      app.use((req: Request, res: Response) => {
        res.status(200).send(req.query.foo as string);
      });

      const response = await sendRequest(
        app,
        createAwsV1Event({
          httpMethod: 'GET',
          queryStringParameters: { foo: 'bar' },
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );
      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual('bar');
    });

    it('should match verbs', async () => {
      app.get('/*', (req: Request, res: Response) => {
        res.status(200).send('foo');
      });
      app.put('/*', (req: Request, res: Response) => {
        res.status(201).send('bar');
      });

      const response = await sendRequest(
        app,
        createAwsV1Event({ httpMethod: 'PUT' }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(201);
      expect(response.body).toEqual('bar');
    });

    it('should handle DELETE method', async () => {
      app.delete('/*', (req: Request, res: Response) => {
        res.status(204).send('deleted');
      });

      const response = await sendRequest(
        app,
        createAwsV1Event({ httpMethod: 'DELETE' }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );
      expect(response.statusCode).toEqual(204);
    });

    it('should handle PATCH method', async () => {
      app.patch('/*', (req: Request, res: Response) => {
        res.status(200).send('patched');
      });

      const response = await sendRequest(
        app,
        createAwsV1Event({
          httpMethod: 'PATCH',
          body: JSON.stringify({ update: 'value' }),
          headers: { 'Content-Type': 'application/json' },
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );
      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual('patched');
    });

    it('should handle custom headers in response', async () => {
      app.use((req: Request, res: Response) => {
        res.setHeader('X-Custom-Header', 'custom-value');
        res.setHeader('X-Another', 'another-value');
        res.status(200).send('ok');
      });

      const response = await sendRequest(
        app,
        createAwsV1Event() as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(response.headers['x-custom-header']).toEqual('custom-value');
      expect(response.headers['x-another']).toEqual('another-value');
    });

    it('should handle response with JSON', async () => {
      app.use((req: Request, res: Response) => {
        res.status(200).json({ message: 'hello', count: 42 });
      });

      const response = await sendRequest(
        app,
        createAwsV1Event() as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'hello', count: 42 });
    });

    it('should handle empty response body', async () => {
      app.use((req: Request, res: Response) => {
        res.status(204).end();
      });

      const response = await sendRequest(
        app,
        createAwsV1Event() as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(204);
      expect(response.body).toEqual('');
    });

    it('should handle 500 error from middleware', async () => {
      app.use(() => {
        throw new Error('Internal server error');
      });

      const response = await sendRequest(
        app,
        createAwsV1Event() as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(500);
    });

    it('should handle request with multiple query parameters', async () => {
      app.use((req: Request, res: Response) => {
        res.status(200).json(req.query);
      });

      const response = await sendRequest(
        app,
        createAwsV1Event({
          httpMethod: 'GET',
          queryStringParameters: {
            foo: 'bar',
            baz: 'qux',
            num: '123',
          },
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(JSON.parse(response.body)).toEqual({
        foo: 'bar',
        baz: 'qux',
        num: '123',
      });
    });

    it('should handle 404 response', async () => {
      app.get('/api/exists', (req: Request, res: Response) => {
        res.status(200).send('exists');
      });

      const response = await sendRequest(
        app,
        createAwsV1Event({
          httpMethod: 'GET',
          path: '/api/notexists',
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(404);
    });
  });

  describe('API Gateway v2 (HTTP API)', () => {
    it('should handle v2 event correctly', async () => {
      app.use((req: Request, res: Response) => {
        res.status(200).send('v2 success');
      });

      const response = await sendRequest(
        app,
        createAwsV2Event() as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual('v2 success');
    });

    it('should handle v2 event with JSON body', async () => {
      app.use(bodyParser.json());
      app.use((req: Request, res: Response) => {
        res.status(200).send(req.body.hello);
      });

      const response = await sendRequest(
        app,
        createAwsV2Event({
          routeKey: 'POST /api/test',
          rawPath: '/api/test',
          body: JSON.stringify({ hello: 'world' }),
          headers: { 'Content-Type': 'application/json' },
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual('world');
    });

    it('should handle v2 event with query parameters', async () => {
      app.use((req: Request, res: Response) => {
        res.status(200).send(req.query.foo as string);
      });

      const response = await sendRequest(
        app,
        createAwsV2Event({
          routeKey: 'GET /api/test',
          rawPath: '/api/test',
          rawQueryString: 'foo=bar',
          queryStringParameters: { foo: 'bar' },
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual('bar');
    });

    it('should handle v2 event with different verbs', async () => {
      app.put('/*', (req: Request, res: Response) => {
        res.status(200).send('put-ok');
      });

      const response = await sendRequest(
        app,
        createAwsV2Event({
          routeKey: 'PUT /api/items',
          rawPath: '/api/items',
        }) as unknown as Record<string, unknown>,
        createAwsContext() as unknown as Record<string, unknown>,
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual('put-ok');
    });
  });

  it('should return AWS response format', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).json({ provider: 'aws' });
    });

    const response = await sendRequest(
      app,
      createAwsV1Event() as unknown as Record<string, unknown>,
      createAwsContext() as unknown as Record<string, unknown>,
    );

    expect(response).toHaveProperty('statusCode');
    expect(response).toHaveProperty('body');
    expect(response).toHaveProperty('headers');
    expect(response).toHaveProperty('isBase64Encoded');
  });
});
