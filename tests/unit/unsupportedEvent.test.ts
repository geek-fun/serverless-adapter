import express from 'express4';
import Koa from 'koa2';
import { Hono } from 'hono';
import serverlessAdapter, {
  UnsupportedEventError,
  eventKeysOf,
  registerProvider,
} from '../../src/index';
import { AliyunProvider } from '../../src/providers/aliyun';
import { ServerlessProvider } from '../../src/providers/base';
import { defaultContext } from '../fixtures/fcContext';
import { createTencentContext } from '../fixtures/tencentContext';
import { createAwsContext } from '../fixtures/awsContext';
import {
  aliyunTimerEvent,
  awsScheduledEvent,
  tencentTimerEvent,
  unknownEvent,
} from '../fixtures/timerContext';

const appWithRootRoute = () => {
  const app = express();
  const root = jest.fn((_req, res) => res.status(200).json({ page: 'spa' }));
  app.get('/', root);
  return { app, root };
};

const captureError = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the handler to reject, but it resolved');
};

describe('non-HTTP invocations (issue #22)', () => {
  it('should throw UnsupportedEventError for an Aliyun time trigger instead of answering it', async () => {
    const { app, root } = appWithRootRoute();
    const handler = serverlessAdapter(app, { provider: 'aliyun' });

    const error = await captureError(handler(aliyunTimerEvent, defaultContext));

    expect(error).toBeInstanceOf(UnsupportedEventError);
    // the framework is never invoked: the timer event is not turned into a request
    expect(root).not.toHaveBeenCalled();
  });

  it('should report provider, kind, trigger name and event keys on the error', async () => {
    const handler = serverlessAdapter(express(), { provider: 'aliyun' });

    const error = (await captureError(
      handler(aliyunTimerEvent, defaultContext),
    )) as UnsupportedEventError;

    expect(error.name).toBe('UnsupportedEventError');
    expect(error.provider).toBe('aliyun');
    expect(error.kind).toBe('timer');
    expect(error.detail).toBe('billing-run');
    expect(error.eventKeys).toEqual(['triggerTime', 'triggerName', 'payload']);
    expect(error.message).toContain('Unsupported timer invocation for provider "aliyun"');
    expect(error.message).toContain('onUnhandledEvent');
  });

  it('should reject a Tencent time trigger with the auto-detected provider', async () => {
    const handler = serverlessAdapter(express());

    const error = (await captureError(
      handler(tencentTimerEvent, createTencentContext()),
    )) as UnsupportedEventError;

    expect(error).toBeInstanceOf(UnsupportedEventError);
    expect(error.provider).toBe('tencent');
    expect(error.kind).toBe('timer');
    expect(error.detail).toBe('billing-run');
  });

  it('should reject an AWS EventBridge scheduled rule', async () => {
    const handler = serverlessAdapter(express());

    const error = (await captureError(
      handler(awsScheduledEvent as unknown as Buffer, createAwsContext()),
    )) as UnsupportedEventError;

    expect(error).toBeInstanceOf(UnsupportedEventError);
    expect(error.provider).toBe('aws');
    expect(error.kind).toBe('timer');
    expect(error.detail).toBe('billing-run');
  });

  it('should reject events that match no known envelope as unknown', async () => {
    const handler = serverlessAdapter(express(), { provider: 'aliyun' });

    const error = (await captureError(
      handler(unknownEvent, defaultContext),
    )) as UnsupportedEventError;

    expect(error).toBeInstanceOf(UnsupportedEventError);
    expect(error.kind).toBe('unknown');
    expect(error.detail).toBeUndefined();
  });

  it('should reject undecodable payloads as unknown without leaking the payload', async () => {
    const handler = serverlessAdapter(express(), { provider: 'aliyun' });

    const error = (await captureError(
      handler(Buffer.from('not json'), defaultContext),
    )) as UnsupportedEventError;

    expect(error.kind).toBe('unknown');
    expect(error.eventKeys).toEqual([]);
  });

  it("should keep the previous permissive behaviour with onUnhandledEvent: 'ignore'", async () => {
    const { app, root } = appWithRootRoute();
    const handler = serverlessAdapter(app, { provider: 'aliyun', onUnhandledEvent: 'ignore' });

    const result = await handler(aliyunTimerEvent, defaultContext);

    // legacy behaviour: the timer event was dispatched as `GET /`
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"page":"spa"}');
    expect(root).toHaveBeenCalledTimes(1);
  });

  it("should still serve HTTP events with onUnhandledEvent: 'ignore'", async () => {
    const { app } = appWithRootRoute();
    const handler = serverlessAdapter(app, { provider: 'aliyun', onUnhandledEvent: 'ignore' });

    const httpEvent = Buffer.from(
      JSON.stringify({
        path: '/',
        httpMethod: 'GET',
        headers: {},
        queryParameters: {},
        pathParameters: {},
        body: undefined,
        isBase64Encoded: false,
      }),
    );

    const result = await handler(httpEvent, defaultContext);

    expect(result.statusCode).toBe(200);
  });

  describe('providers that do not implement classifyEvent', () => {
    // Custom providers registered outside this package keep the historical
    // behaviour: without classifyEvent their invocations are treated as HTTP.
    const realProvider = new AliyunProvider();
    const legacyProvider: ServerlessProvider = {
      name: realProvider.name,
      normalizeEvent: (event) => realProvider.normalizeEvent(event),
      createRequest: (event) => realProvider.createRequest(event),
      formatResponse: (response) => realProvider.formatResponse(response),
      detect: (event, context) => realProvider.detect(event, context),
    };

    afterAll(() => {
      registerProvider(new AliyunProvider());
    });

    it('should dispatch without classification', async () => {
      registerProvider(legacyProvider);
      const { app, root } = appWithRootRoute();
      const handler = serverlessAdapter(app, { provider: 'aliyun' });

      const result = await handler(aliyunTimerEvent, defaultContext);

      expect(result.statusCode).toBe(200);
      expect(root).toHaveBeenCalledTimes(1);
    });
  });
  describe('classification is framework independent', () => {
    const frameworks: Array<[string, () => unknown]> = [
      [
        'express',
        () => {
          const app = express();
          app.get('/', (_req, res) => res.json({ page: 'spa' }));
          return app;
        },
      ],
      [
        'koa',
        () => {
          const app = new Koa();
          app.use((ctx) => {
            ctx.body = 'ok';
          });
          return app;
        },
      ],
      [
        'hono',
        () => {
          const app = new Hono();
          app.get('/', (c) => c.json({ page: 'spa' }));
          return app;
        },
      ],
    ];

    for (const [name, createApp] of frameworks) {
      it(`should reject a timer invocation before a ${name} app runs`, async () => {
        const handler = serverlessAdapter(createApp() as Parameters<typeof serverlessAdapter>[0], {
          provider: 'aliyun',
        });

        const error = await captureError(handler(aliyunTimerEvent, defaultContext));

        expect(error).toBeInstanceOf(UnsupportedEventError);
      });
    }
  });
});

describe('eventKeysOf', () => {
  it('should report the keys of Buffer, string and object events', () => {
    expect(eventKeysOf(aliyunTimerEvent)).toEqual(['triggerTime', 'triggerName', 'payload']);
    expect(eventKeysOf('{"a":1}')).toEqual(['a']);
    expect(eventKeysOf({ a: 1, b: 2 })).toEqual(['a', 'b']);
  });

  it('should summarize arrays and ignore undecodable payloads', () => {
    expect(eventKeysOf([1, 2, 3])).toEqual(['<array>']);
    expect(eventKeysOf(Buffer.from('not json'))).toEqual([]);
    expect(eventKeysOf(undefined)).toEqual([]);
  });
});
