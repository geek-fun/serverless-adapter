import express from 'express4';
import Koa from 'koa2';
import { Hono } from 'hono';
import serverlessAdapter, {
  FrameworkApp,
  UnsupportedEventError,
  TimerEvent,
} from '../../src/index';
import { defaultContext } from '../fixtures/fcContext';
import { createAwsContext } from '../fixtures/awsContext';
import { createTencentContext, createTencentFunctionUrlEvent } from '../fixtures/tencentContext';
import { createVolcengineContext, createVolcengineEvent } from '../fixtures/volcengineContext';
import {
  aliyunTimerEvent,
  awsScheduledEvent,
  tencentTimerEvent,
  unknownEvent,
  volcengineTimerEvent,
} from '../fixtures/timerContext';

type AppKit = {
  app: FrameworkApp;
  httpHandler: jest.Mock;
};

const buildApp = (framework: string): AppKit => {
  const httpHandler = jest.fn();

  if (framework === 'express') {
    const app = express();
    httpHandler.mockImplementation((_req, res) => res.status(200).json({ page: 'spa' }));
    app.all('*', httpHandler);
    return { app, httpHandler };
  }

  if (framework === 'koa') {
    const app = new Koa();
    httpHandler.mockImplementation((ctx) => {
      ctx.status = 200;
      ctx.body = 'koa-spa';
    });
    app.use(httpHandler);
    return { app, httpHandler };
  }

  const app = new Hono();
  httpHandler.mockImplementation((c) => c.json({ page: 'spa' }));
  app.all('*', httpHandler);
  return { app, httpHandler };
};

type ProviderKit = {
  httpEvent: unknown;
  timerEvent: unknown;
  timerProvider: string;
  timerName: string;
  context: unknown;
};

/**
 * The invocation shapes each platform actually delivers to the single handler.
 */
const providerKits: Record<string, ProviderKit> = {
  aliyun: {
    httpEvent: Buffer.from(
      JSON.stringify({ path: '/', httpMethod: 'GET', headers: {}, queryParameters: {} }),
    ),
    timerEvent: aliyunTimerEvent,
    timerProvider: 'aliyun',
    timerName: 'billing-run',
    context: defaultContext,
  },
  tencent: {
    httpEvent: Buffer.from(JSON.stringify(createTencentFunctionUrlEvent())),
    timerEvent: tencentTimerEvent,
    timerProvider: 'tencent',
    timerName: 'billing-run',
    context: createTencentContext(),
  },
  volcengine: {
    httpEvent: Buffer.from(JSON.stringify(createVolcengineEvent())),
    timerEvent: volcengineTimerEvent,
    timerProvider: 'volcengine',
    timerName: 'billing-run',
    context: createVolcengineContext(),
  },
  aws: {
    httpEvent: Buffer.from(
      JSON.stringify({
        path: '/',
        httpMethod: 'GET',
        headers: {},
        queryStringParameters: {},
        pathParameters: {},
        body: null,
        isBase64Encoded: false,
      }),
    ),
    timerEvent: awsScheduledEvent,
    timerProvider: 'aws',
    timerName: 'billing-run',
    context: createAwsContext(),
  },
  // Cloudflare has no timer envelope: Cron Triggers are delivered to the
  // Worker's separate `scheduled()` export and never reach the adapter.
  cloudflare: {
    httpEvent: new Request('https://example.com/'),
    timerEvent: tencentTimerEvent,
    timerProvider: 'cloudflare',
    timerName: 'billing-run',
    context: { waitUntil: jest.fn() },
  },
};

const frameworks = ['express', 'koa', 'hono'] as const;
const providers = Object.keys(providerKits);

describe('events handlers: {http, timer, unknown} × providers × frameworks (issue #23)', () => {
  const timerJob = jest.fn();

  beforeEach(() => {
    timerJob.mockReset();
    timerJob.mockResolvedValue({ jobDone: true });
  });

  for (const providerName of providers) {
    const kit = providerKits[providerName];

    describe(`${providerName}`, () => {
      for (const framework of frameworks) {
        it(`routes an HTTP event to the ${framework} app`, async () => {
          const { app, httpHandler } = buildApp(framework);
          const handler = serverlessAdapter(app, {
            provider: providerName as never,
            events: { timer: timerJob, nonHttp: jest.fn() },
          });

          const result = (await handler(kit.httpEvent as never, kit.context as never)) as {
            statusCode: number;
          };

          expect(result.statusCode).toBe(200);
          expect(httpHandler).toHaveBeenCalledTimes(1);
          expect(timerJob).not.toHaveBeenCalled();
        });

        it(`routes a timer invocation to events.timer (${framework} app untouched)`, async () => {
          const { app, httpHandler } = buildApp(framework);
          const handler = serverlessAdapter(app, {
            provider: providerName as never,
            events: { timer: timerJob, nonHttp: jest.fn() },
          });

          const result = await handler(kit.timerEvent as never, kit.context as never);

          // Cloudflare is the exception asserted separately below; every other
          // provider recognizes its own timer envelope positively.
          if (providerName === 'cloudflare') {
            expect(timerJob).not.toHaveBeenCalled();
            expect(httpHandler).not.toHaveBeenCalled();
            return;
          }

          expect(result).toEqual({ jobDone: true });
          expect(timerJob).toHaveBeenCalledTimes(1);
          expect(httpHandler).not.toHaveBeenCalled();
        });

        it(`routes an unrecognized invocation to events.nonHttp (${framework} app untouched)`, async () => {
          const { app, httpHandler } = buildApp(framework);
          const nonHttp = jest.fn().mockResolvedValue('queue-accepted');
          const handler = serverlessAdapter(app, {
            provider: providerName as never,
            events: { nonHttp },
          });

          const result = await handler(unknownEvent as never, kit.context as never);

          expect(result).toBe('queue-accepted');
          expect(nonHttp).toHaveBeenCalledWith(unknownEvent, kit.context);
          expect(httpHandler).not.toHaveBeenCalled();
          expect(timerJob).not.toHaveBeenCalled();
        });
      }

      if (providerName !== 'cloudflare') {
        it('delivers a normalized TimerEvent with the raw event preserved', async () => {
          const { app } = buildApp('express');
          const handler = serverlessAdapter(app, {
            provider: providerName as never,
            events: { timer: timerJob },
          });

          await handler(kit.timerEvent as never, kit.context as never);

          const delivered = timerJob.mock.calls[0][0] as TimerEvent;
          expect(delivered.provider).toBe(kit.timerProvider);
          expect(delivered.triggerName).toBe(kit.timerName);
          expect(delivered.raw).toBe(kit.timerEvent);
        });
      }

      if (providerName === 'cloudflare') {
        it('classifies even a Tencent-shaped timer as unknown (no cloudflare timer envelope)', async () => {
          const { app } = buildApp('express');
          const nonHttp = jest.fn().mockResolvedValue('cf-unknown');
          const handler = serverlessAdapter(app, {
            provider: 'cloudflare',
            events: { timer: timerJob, nonHttp },
          });

          const result = await handler(tencentTimerEvent as never, kit.context as never);

          expect(result).toBe('cf-unknown');
          expect(nonHttp).toHaveBeenCalledWith(tencentTimerEvent, kit.context);
          expect(timerJob).not.toHaveBeenCalled();
        });
      }
    });
  }
});

describe('events routing details (issue #23)', () => {
  const captureError = async (promise: Promise<unknown>): Promise<unknown> => {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    throw new Error('expected the handler to reject, but it resolved');
  };

  const expressApp = () => {
    const app = express();
    const root = jest.fn((_req, res) => res.status(200).json({ page: 'spa' }));
    app.get('/', root);
    return { app, root };
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('passes the timer handler return value through verbatim', async () => {
    const { app } = expressApp();

    const objectHandler = serverlessAdapter(app, {
      provider: 'aliyun',
      events: { timer: () => ({ done: true }) },
    });
    expect(await objectHandler(aliyunTimerEvent, defaultContext)).toEqual({ done: true });

    const stringHandler = serverlessAdapter(app, {
      provider: 'aliyun',
      events: { timer: () => 'plain' },
    });
    expect(await stringHandler(aliyunTimerEvent, defaultContext)).toBe('plain');

    const asyncUndefined = serverlessAdapter(app, {
      provider: 'aliyun',
      events: { timer: async () => undefined },
    });
    expect(await asyncUndefined(aliyunTimerEvent, defaultContext)).toBeUndefined();

    const voidHandler = serverlessAdapter(app, {
      provider: 'aliyun',
      events: { timer: () => undefined },
    });
    expect(await voidHandler(aliyunTimerEvent, defaultContext)).toBeUndefined();
  });

  it('delivers the parsed payload, trigger name and time to events.timer', async () => {
    const { app } = expressApp();
    const timer = jest.fn();
    const handler = serverlessAdapter(app, { provider: 'aliyun', events: { timer } });

    await handler(aliyunTimerEvent, defaultContext);

    expect(timer.mock.calls[0][0]).toEqual({
      provider: 'aliyun',
      triggerName: 'billing-run',
      triggerTime: '2026-10-01T03:23:00Z',
      payload: { job: 'billing-run' },
      raw: aliyunTimerEvent,
    });
    expect(timer.mock.calls[0][1]).toBe(defaultContext);
  });

  it('fails the invocation loudly when a timer arrives without events.timer', async () => {
    const { app, root } = expressApp();
    const handler = serverlessAdapter(app, { provider: 'aliyun', events: { nonHttp: jest.fn() } });

    const error = (await captureError(handler(aliyunTimerEvent, defaultContext))) as
      | UnsupportedEventError
      | undefined;

    expect(error).toBeInstanceOf(UnsupportedEventError);
    expect(error?.kind).toBe('timer');
    expect(error?.detail).toBe('billing-run');
    expect(root).not.toHaveBeenCalled();
  });

  it('fails the invocation loudly when an unknown event arrives without events.nonHttp', async () => {
    const { app, root } = expressApp();
    const handler = serverlessAdapter(app, { provider: 'aliyun', events: { timer: jest.fn() } });

    const error = (await captureError(handler(unknownEvent, defaultContext))) as
      | UnsupportedEventError
      | undefined;

    expect(error).toBeInstanceOf(UnsupportedEventError);
    expect(error?.kind).toBe('unknown');
    expect(root).not.toHaveBeenCalled();
  });

  it("keeps the legacy dispatch as the 'ignore' fallback when no handler matches", async () => {
    const { app, root } = expressApp();
    const handler = serverlessAdapter(app, {
      provider: 'aliyun',
      onUnhandledEvent: 'ignore',
      events: { nonHttp: jest.fn() },
    });

    const result = (await handler(aliyunTimerEvent, defaultContext)) as { statusCode: number };

    // no events.timer → legacy permissive behaviour: dispatched into the app
    expect(result.statusCode).toBe(200);
    expect(root).toHaveBeenCalledTimes(1);
  });

  it("lets explicit handlers win even with onUnhandledEvent: 'ignore'", async () => {
    const { app, root } = expressApp();
    const timer = jest.fn().mockResolvedValue('handled');
    const handler = serverlessAdapter(app, {
      provider: 'aliyun',
      onUnhandledEvent: 'ignore',
      events: { timer },
    });

    expect(await handler(aliyunTimerEvent, defaultContext)).toBe('handled');
    expect(timer).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveBeenCalled();
  });

  it('propagates errors thrown inside events.timer instead of answering a 500', async () => {
    const { app } = expressApp();
    const handler = serverlessAdapter(app, {
      provider: 'aliyun',
      events: {
        timer: () => {
          throw new Error('job exploded');
        },
      },
    });

    const error = await captureError(handler(aliyunTimerEvent, defaultContext));

    expect((error as Error).message).toBe('job exploded');
  });

  it('keeps serving HTTP events unchanged when events is provided', async () => {
    const { app, root } = expressApp();
    const handler = serverlessAdapter(app, {
      provider: 'aliyun',
      events: { timer: jest.fn(), nonHttp: jest.fn() },
    });

    const httpEvent = Buffer.from(
      JSON.stringify({ path: '/', httpMethod: 'GET', headers: {}, queryParameters: {} }),
    );
    const result = (await handler(httpEvent, defaultContext)) as { statusCode: number };

    expect(result.statusCode).toBe(200);
    expect(root).toHaveBeenCalledTimes(1);
  });
});

describe('symmetric entrypoint form (issue #23)', () => {
  const expressApp = () => {
    const app = express();
    const root = jest.fn((_req, res) => res.status(200).json({ page: 'spa' }));
    app.get('/', root);
    return { app, root };
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('accepts the app inside events and routes both trigger kinds', async () => {
    const { app, root } = expressApp();
    const timer = jest.fn().mockResolvedValue('timer-ok');
    const nonHttp = jest.fn().mockResolvedValue('queue-ok');

    const handler = serverlessAdapter({
      provider: 'aliyun',
      events: { http: app, timer, nonHttp },
    });

    const httpEvent = Buffer.from(
      JSON.stringify({ path: '/', httpMethod: 'GET', headers: {}, queryParameters: {} }),
    );
    expect(await handler(httpEvent as never, defaultContext as never)).toMatchObject({
      statusCode: 200,
    });
    expect(await handler(aliyunTimerEvent as never, defaultContext as never)).toBe('timer-ok');
    expect(await handler(unknownEvent as never, defaultContext as never)).toBe('queue-ok');
    expect(root).toHaveBeenCalledTimes(1);
  });

  it('auto-detects the provider in the symmetric form', async () => {
    const { app, root } = expressApp();
    const timer = jest.fn().mockResolvedValue('timer-ok');

    const handler = serverlessAdapter({ events: { http: app, timer } });

    expect(await handler(aliyunTimerEvent as never, defaultContext as never)).toBe('timer-ok');
    expect(root).not.toHaveBeenCalled();
  });

  it('rejects the symmetric form without a framework app in events.http', () => {
    expect(() => serverlessAdapter({ provider: 'aliyun', events: {} as never })).toThrow(
      /events\.http/,
    );
    expect(() => serverlessAdapter({ events: { http: { notAFramework: true } } as never })).toThrow(
      /events\.http/,
    );
    expect(() => serverlessAdapter({ provider: 'aliyun' } as never)).toThrow(/framework app/);
    expect(() => serverlessAdapter(null as never)).toThrow(/framework app/);
  });

  it('rejects passing both a positional app and events.http', () => {
    const { app } = expressApp();

    expect(() => serverlessAdapter(app, { events: { http: app } as never })).toThrow(
      /both a positional app and events\.http/,
    );
  });

  it('still accepts the positional app with only timer/nonHttp handlers', async () => {
    const { app, root } = expressApp();
    const timer = jest.fn().mockResolvedValue('timer-ok');

    const handler = serverlessAdapter(app, { provider: 'aliyun', events: { timer } });

    expect(await handler(aliyunTimerEvent, defaultContext)).toBe('timer-ok');
    expect(root).not.toHaveBeenCalled();
  });
});
