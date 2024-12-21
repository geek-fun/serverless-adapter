import Koa from 'koa';
import Router from '@koa/router';
import koaBody from 'koa-body';
import serverlessAdapter from '../src';
import { defaultContext, defaultEvent } from './fixtures/fcContext';

describe('koa', () => {
  let app: Koa;
  let router: Router;
  beforeEach(() => {
    app = new Koa();
    app.use(koaBody());
    router = new Router();
  });

  it('basic middleware should set statusCode and default body', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 418;
      ctx.body = 'Hello, world koa!';
    });
    app.use(router.routes());

    const response = await serverlessAdapter(app)(defaultEvent, defaultContext);

    expect(response.statusCode).toEqual(418);
    expect(response.body).toEqual('Hello, world koa!');
  });

  it('basic middleware should get text body', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.body;
    });
    app.use(router.routes());

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
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.body.hello;
    });

    const response = await serverlessAdapter(app)(
      {
        ...defaultEvent,
        httpMethod: 'GET',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'Content-Type': 'application/json' },
      },
      defaultContext,
    );

    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('world');
  });

  it('basic middleware should get undefined body', async () => {
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      ctx.body = ctx.request.body.hello;
    });

    const response = await serverlessAdapter(app)(
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
    router.get('/api/test', (ctx) => {
      ctx.status = 200;
      ctx.body = ctx.request.query.foo;
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
    router.get('/*', (ctx) => {
      ctx.status = 200;
      ctx.body = 'foo';
    });
    router.put('/*', (ctx) => {
      ctx.status = 201;
      ctx.body = 'bar';
    });
    app.use(router.routes());

    const response = await serverlessAdapter(app)(
      { ...defaultEvent, httpMethod: 'PUT' },
      defaultContext,
    );

    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual('bar');
  });

  // it('should serve files', async () => {
  //   app.use(express.static('tests/fixtures'));
  //
  //   const response = await serverlessAdapter(app)(
  //     {
  //       ...defaultEvent,
  //       httpMethod: 'GET',
  //       path: '/file.txt',
  //     },
  //     defaultContext,
  //   );
  //   expect(response.statusCode).toEqual(200);
  //   expect(response.body).toEqual('this is a test\n');
  // });
  //
  // it('destroy weird', async () => {
  //   app.use((req: Request, res: Response) => {
  //     // this was causing a .destroy is not a function error
  //     res.send('test');
  //     res.json({ test: 'test' });
  //   });
  //
  //   const response = await serverlessAdapter(app)(
  //     {
  //       ...defaultEvent,
  //       httpMethod: 'GET',
  //     },
  //     defaultContext,
  //   );
  //   expect(response.statusCode).toEqual(200);
  //   expect(response.body).toEqual('test');
  // });
});
