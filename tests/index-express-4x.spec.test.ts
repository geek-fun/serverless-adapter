import express, { Express, Request, Response } from 'express4';
import bodyParser from 'body-parser';
import { defaultContext, defaultEvent } from './fixtures/fcContext';
import { sendRequest } from './fixtures/requestHelper';

describe('express 4.x', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it('basic middleware should set statusCode and default body', async () => {
    app.use((req: Request, res: Response) => {
      res.status(418).send(`I'm a teapot`);
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);
    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual(`I'm a teapot`);
  });

  it('basic middleware should get text body', async () => {
    app.use(bodyParser.text());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body);
    });
    const response = await sendRequest(
      app,
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

    const response = await sendRequest(
      app,
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

  it('basic middleware should get undefined body', async () => {
    app.use(bodyParser.json());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body.hello);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        body: undefined,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toBeDefined();
  });

  it('basic middleware should get query params', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.query.foo as string);
    });

    const response = await sendRequest(
      app,
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
    app.get('/*', (req: Request, res: Response) => {
      res.status(200).send('foo');
    });
    app.put('/*', (req: Request, res: Response) => {
      res.status(201).send('bar');
    });

    const response = await sendRequest(app, { ...defaultEvent, httpMethod: 'PUT' }, defaultContext);

    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual('bar');
  });

  it('should serve files', async () => {
    app.use(express.static('tests/fixtures'));

    const response = await sendRequest(
      app,
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

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('test');
  });

  it('should handle DELETE method', async () => {
    app.delete('/api/test', (req: Request, res: Response) => {
      res.status(204).send('deleted');
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'DELETE',
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(204);
  });

  it('should handle PATCH method', async () => {
    app.patch('/api/test', (req: Request, res: Response) => {
      res.status(200).send('patched');
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'PATCH',
        body: JSON.stringify({ update: 'value' }),
        headers: { 'Content-Type': 'application/json' },
      },
      defaultContext,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('patched');
  });

  it('should handle multiple set-cookie headers', async () => {
    app.use((req: Request, res: Response) => {
      res.setHeader('Set-Cookie', ['cookie1=value1', 'cookie2=value2']);
      res.status(200).send('ok');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('ok');
  });

  it('should handle response with Buffer body', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).send(Buffer.from('buffer response'));
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('buffer response');
  });

  it('should handle response with JSON', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).json({ message: 'hello', count: 42 });
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'hello', count: 42 });
  });

  it('should handle custom headers in response', async () => {
    app.use((req: Request, res: Response) => {
      res.setHeader('X-Custom-Header', 'custom-value');
      res.setHeader('X-Another', 'another-value');
      res.status(200).send('ok');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(200);
    expect(response.headers['x-custom-header']).toEqual('custom-value');
    expect(response.headers['x-another']).toEqual('another-value');
  });

  it('should handle writeHead with status code and headers', async () => {
    app.use((req: Request, res: Response) => {
      res.writeHead(201, { Location: '/api/test/1', 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 1 }));
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(201);
    expect(response.headers['location']).toEqual('/api/test/1');
  });

  it('should handle empty response body', async () => {
    app.use((req: Request, res: Response) => {
      res.status(204).end();
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(204);
    expect(response.body).toEqual('');
  });

  it('should handle URL-encoded body', async () => {
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body.name);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'POST',
        body: 'name=john&age=30',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('john');
  });

  it('should handle raw body', async () => {
    app.use(bodyParser.raw());
    app.use((req: Request, res: Response) => {
      res.status(200).send(req.body.toString());
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'POST',
        body: 'raw binary data',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('raw binary data');
  });

  it('should handle 404 response', async () => {
    app.get('/api/exists', (req: Request, res: Response) => {
      res.status(200).send('exists');
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        path: '/api/notexists',
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(404);
  });

  it('should handle 500 error from middleware', async () => {
    app.use(() => {
      throw new Error('Internal server error');
    });

    const response = await sendRequest(app, defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(500);
  });

  it('should handle request with multiple query parameters', async () => {
    app.use((req: Request, res: Response) => {
      res.status(200).json(req.query);
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        queryParameters: {
          foo: 'bar',
          baz: 'qux',
          num: '123',
        },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({
      foo: 'bar',
      baz: 'qux',
      num: '123',
    });
  });

  it('should handle request with path parameters', async () => {
    app.get('/api/users/:id', (req: Request, res: Response) => {
      res.status(200).json({ userId: req.params.id });
    });

    const response = await sendRequest(
      app,
      {
        ...defaultEvent,
        httpMethod: 'GET',
        path: '/api/users/123',
        pathParameters: { id: '123' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ userId: '123' });
  });
});
