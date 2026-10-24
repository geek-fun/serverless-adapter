<div align="center">

<img src="docs/brand/brand.jpg" alt="Serverless-Adapter" width="360" />

# Serverless-Adapter

**Run your Express, Koa, or Hono app on any serverless platform — no rewrites.**

**One handler. Multi-cloud. Automatic provider detection.**

**Express · Koa · Hono — Aliyun FC · Tencent SCF · Volcengine veFaaS · AWS Lambda · Cloudflare Workers.**

[![Release](https://img.shields.io/github/v/release/geek-fun/serverless-adapter?color=orange&label=release&logo=github)](https://github.com/geek-fun/serverless-adapter/releases)
[![npm version](https://img.shields.io/npm/v/@geek-fun/serverless-adapter?color=orange&logo=npm)](https://www.npmjs.com/package/@geek-fun/serverless-adapter)
[![npm downloads](https://img.shields.io/npm/dm/@geek-fun/serverless-adapter?color=orange&logo=npm)](https://www.npmjs.com/package/@geek-fun/serverless-adapter)
[![Node.js CI](https://github.com/geek-fun/serverless-adapter/actions/workflows/node.yml/badge.svg)](https://github.com/geek-fun/serverless-adapter/actions/workflows/node.yml)
[![codecov](https://codecov.io/gh/geek-fun/serverless-adapter/graph/badge.svg?token=lw1AJuX9S9)](https://codecov.io/gh/geek-fun/serverless-adapter)
[![Known Vulnerabilities](https://snyk.io/test/github/geek-fun/serverless-adapter/badge.svg)](https://snyk.io/test/github/geek-fun/serverless-adapter)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?logo=apache)](LICENSE)
[![Stars](https://img.shields.io/github/stars/geek-fun/serverless-adapter?logo=github)](https://github.com/geek-fun/serverless-adapter/stargazers)

<p>
  <img src="https://img.shields.io/badge/Node.js_%E2%89%A5_16-339933?logo=nodedotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Express-000000?logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/Koa-33333D"/>
  <img src="https://img.shields.io/badge/Hono-E10098?logo=hono&logoColor=white"/>
</p>
<p>
  <img src="https://img.shields.io/badge/Aliyun%20FC-FF6A00?logo=alibabacloud&logoColor=white"/>
  <img src="https://img.shields.io/badge/Tencent%20SCF-0A9AED?logo=tencentqq&logoColor=white"/>
  <img src="https://img.shields.io/badge/Volcengine%20veFaaS-1677FF"/>
  <img src="https://img.shields.io/badge/AWS%20Lambda-232F3E?logo=amazonwebservices&logoColor=white"/>
  <img src="https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white"/>
</p>

[npm](https://www.npmjs.com/package/@geek-fun/serverless-adapter) · [Releases](https://github.com/geek-fun/serverless-adapter/releases) · [Issues](https://github.com/geek-fun/serverless-adapter/issues)

English · [简体中文](README.zh-CN.md)

</div>

---

Serverless-Adapter is a thin adapter layer that runs **Express**, **Koa**, and **Hono** applications on serverless platforms across five cloud providers. Your app code never changes: the adapter translates each platform's invocation event into framework requests, and framework responses back into the platform's response envelope — with **automatic provider detection**, so the same handler deploys unchanged across clouds.

## Contents

- [Key Features](#key-features)
- [Supported Cloud Providers](#supported-cloud-providers)
- [Supported Frameworks](#supported-frameworks)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Timer and non-HTTP triggers](#timer-and-non-http-triggers)
- [Provider Detection](#provider-detection)
- [Contributing](#contributing)
- [Related Projects](#related-projects)

## Key Features

- **Multi-cloud, one handler** — deploy the same app to Alibaba Cloud FC, Tencent Cloud SCF, Volcengine veFaaS, AWS Lambda, and Cloudflare Workers without per-cloud glue code.
- **Automatic provider detection** — the adapter inspects the invocation context and routes to the right provider; an explicit override is available when you need it.
- **Timer & non-HTTP triggers, done right** — a normalized, provider-agnostic `TimerEvent` envelope, conservative event classification, and loud failures for unmatched non-HTTP invocations instead of silently swallowed events.
- **Framework agnostic** — Express 4/5, Koa 2/3, and Hono 4 are supported; your routes, middleware, and handlers stay untouched.
- **TypeScript-first** — full type inference, with the handler's result type narrowing automatically once non-HTTP events are configured (`ServerlessHandler<Result>`).
- **Lightweight** — only two runtime dependencies (`debug`, `raw-body`).

## Supported Cloud Providers

| Provider               | Service                         | Status       | Trigger Type                            |
| ---------------------- | ------------------------------- | ------------ | --------------------------------------- |
| Alibaba Cloud (Aliyun) | Function Compute                | ✅ Supported | API Gateway                             |
| Tencent Cloud          | Serverless Cloud Function (SCF) | ✅ Supported | Function URL                            |
| Volcengine             | veFaaS (函数服务)               | ✅ Supported | API Gateway                             |
| AWS                    | Lambda + API Gateway            | ✅ Supported | API Gateway (REST API v1 & HTTP API v2) |
| Cloudflare             | Workers                         | ✅ Supported | fetch (Request → Response)              |

> **Note**: Tencent retired the SCF API Gateway trigger (service ended 2025-06-30); this adapter supports the Function URL (函数 URL) event-function format. Web 函数 (Web functions, raw HTTP on port 9000) mode needs no adapter and is out of scope.

## Supported Frameworks

| Framework | Version | Status       |
| --------- | ------- | ------------ |
| Express   | 4.x     | ✅ Supported |
| Express   | 5.x     | ✅ Supported |
| Koa       | 2.x     | ✅ Supported |
| Koa       | 3.x     | ✅ Supported |
| Hono      | 4.x     | ✅ Supported |

> **Note**: Hono support requires Node.js >= 18 (for Web API Request/Response globals).
> Express and Koa continue to support Node.js >= 16.

## Quick Start

### Prerequisites

- Node.js >= 16.x

### Install

```bash
npm install @geek-fun/serverless-adapter
```

### Usage

#### Auto-detect Provider (Recommended)

The adapter automatically detects the cloud provider based on the context object:

```typescript
import express from 'express';
import serverlessAdapter from '@geek-fun/serverless-adapter';

const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

// Auto-detect provider based on context
export const handler = serverlessAdapter(app);
```

#### Explicit Provider Selection

You can explicitly specify the provider:

```typescript
import express from 'express';
import serverlessAdapter from '@geek-fun/serverless-adapter';

const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Tencent Cloud!' });
});

// Explicitly specify Tencent provider
export const main_handler = serverlessAdapter(app, { provider: 'tencent' });
```

#### Aliyun Function Compute Example

```typescript
import express from 'express';
import serverlessAdapter from '@geek-fun/serverless-adapter';

const app = express();

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// Handler for Aliyun Function Compute
export const handler = serverlessAdapter(app);
```

#### Tencent SCF Example

```typescript
import express from 'express';
import serverlessAdapter from '@geek-fun/serverless-adapter';

const app = express();

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// Handler for Tencent SCF
export const main_handler = serverlessAdapter(app, { provider: 'tencent' });
```

#### Volcengine veFaaS Example

```typescript
import express from 'express';
import serverlessAdapter from '@geek-fun/serverless-adapter';

const app = express();

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// Handler for Volcengine veFaaS
export const handler = serverlessAdapter(app, { provider: 'volcengine' });
```

#### Cloudflare Workers Example

```typescript
import express from 'express';
import serverlessAdapter from '@geek-fun/serverless-adapter';

const app = express();

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

const handler = serverlessAdapter(app, { provider: 'cloudflare' });

export default {
  async fetch(request: Request, context: ExecutionContext): Promise<Response> {
    const result = await handler(request, context);
    const headers = new Headers(result.headers as Record<string, string>);
    (result.multiValueHeaders ?? {}).setCookie?.forEach((cookie) => headers.append('set-cookie', cookie));

    const body = result.isBase64Encoded
      ? Buffer.from(result.body, 'base64')
      : result.body;

    return new Response(body, { status: result.statusCode, headers });
  },
};
```

#### Hono Example

```typescript
import { Hono } from 'hono';
import serverlessAdapter from '@geek-fun/serverless-adapter';

const app = new Hono();

app.get('/', (c) => c.json({ message: 'Hello from Hono!' }));

// Auto-detect provider based on context
export const handler = serverlessAdapter(app);
```

## API Reference

### `serverlessAdapter(app, options?)`

Creates a serverless handler for your Express, Koa, or Hono application. This
positional form is the canonical shape for HTTP-only apps.

#### Parameters

| Parameter                  | Type                                                             | Required | Description                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`                      | `Express \| Koa \| Hono`                                         | Yes      | Express, Koa, or Hono application instance                                                                                                                                                   |
| `options.provider`         | `'aliyun' \| 'tencent' \| 'volcengine' \| 'aws' \| 'cloudflare'` | No       | Explicitly specify cloud provider (auto-detected if omitted)                                                                                                                                  |
| `options.events`           | `{ timer?, nonHttp? }`                                           | No       | Handlers for non-HTTP triggers, keyed by event kind — see [Timer and non-HTTP triggers](#timer-and-non-http-triggers)                                                                          |
| `options.onUnhandledEvent` | `'error' \| 'ignore'`                                            | No       | What to do with a non-HTTP invocation that has no matching `events` handler. Defaults to `'error'` (throw); `'ignore'` restores the historical behaviour — see [Timer and non-HTTP triggers](#timer-and-non-http-triggers) |

#### Returns

A function that handles serverless events. Its result type follows the form:

```typescript
// HTTP-only forms (positional app, no `events` handlers): the HTTP envelope
(event: Buffer, context: ProviderContext) =>
  Promise<{
    statusCode: number;
    body: string;
    headers: Record<string, string>;
    isBase64Encoded: boolean;
  }>;

// Any form with `events` handlers: the invocation may be a timer / queue event,
// so the result is whatever that handler returned — `ServerlessHandler<unknown>`
(event: Buffer, context: ProviderContext) => Promise<unknown>;
```

HTTP invocations return the envelope; the result of a timer / non-HTTP invocation
is whatever the corresponding `events` handler returned, passed through
verbatim. The types mirror that exactly: once `events` handlers are configured the
handler is typed `ServerlessHandler<unknown>`, so the compiler does not pretend a
timer result is an HTTP envelope. `ServerlessHandler<Result>` and
`ServerlessHandlerResult` are exported for annotating your own code.

### `serverlessAdapter({ provider, events: { http, timer } })` (symmetric form)

For multi-trigger functions the HTTP app can be declared inside `events`, next
to the other handlers. Both forms are accepted — the first argument is
unambiguous to tell apart (an Express app is a function, Koa exposes
`.callback`, Hono exposes `.fetch`, an options object has none of those):

```typescript
// HTTP-only app — canonical, unchanged
serverlessAdapter(app, { provider: 'volcengine' });

// multi-trigger function (HTTP + timer) — uniform, recommended for this case
serverlessAdapter({
  provider: 'volcengine',
  events: { http: app, timer: runTimerJob },
});
```

The symmetric form takes the same `provider` / `onUnhandledEvent` options; the
positional form stays canonical for HTTP-only apps.

## Timer and non-HTTP triggers

On Aliyun FC, Tencent SCF, Volcengine veFaaS and AWS Lambda **one function has one
handler and every trigger type is delivered to it as a different event shape**. A
timer trigger, a queue event or an object-storage notification therefore reaches
the same handler as an HTTP request — but it carries no request to build and no
HTTP response contract to satisfy.

Dispatching such an invocation into the web framework answers a request nobody
made, and the platform records the invocation as **successful**: a scheduled job
then silently never runs. The adapter therefore classifies every invocation
before it is normalized. With `events` handlers registered, non-HTTP invocations
are routed to them; without a matching handler the invocation fails loudly:

```typescript
const http = serverlessAdapter(app);

export const handler = (event, context) => http(event, context);
// A timer trigger makes this invocation reject with:
//   UnsupportedEventError: Unsupported timer invocation for provider "aliyun"
//   (trigger "billing-run"): this adapter only handles HTTP events. Handle
//   non-HTTP triggers in your own entrypoint, or pass
//   { onUnhandledEvent: 'ignore' } to keep the previous behaviour.
//   Event keys: triggerTime, triggerName, payload.
```

### Handling timers with `events.timer`

Register an `events.timer` handler and the adapter normalizes every positively
identified timer invocation into a provider-agnostic `TimerEvent` for you:

```typescript
import serverlessAdapter from '@geek-fun/serverless-adapter';

const runTimerJob = async (event: TimerEvent) => {
  console.log(`timer ${event.triggerName} fired at ${event.triggerTime}`);
  if (event.payload?.job === 'billing-run') {
    await runBillingRun();
  }
  // the return value is passed through to the platform verbatim —
  // it is never wrapped into a fake statusCode/body
};

export const handler = serverlessAdapter(app, {
  provider: 'aliyun',
  events: {
    timer: runTimerJob,
    // anything positively identified as non-HTTP but not a timer
    // (queue events, object-storage notifications, …)
    nonHttp: (raw, context) => handleOtherTrigger(raw, context),
  },
});
```

The normalized envelope is identical across providers:

```typescript
export type TimerEvent = {
  provider: CloudProvider; // informational (logs/telemetry), never a dispatch key
  triggerName?: string;
  triggerTime?: string;
  payload?: unknown;       // JSON-parsed when parseable, otherwise the raw string
  raw: unknown;            // the untouched platform event — never lose information
};
```

Or use the symmetric form, which reads the same as the deployment it describes:

```typescript
export const handler = serverlessAdapter({
  provider: 'aliyun',
  events: { http: app, timer: runTimerJob },
});
```

Notes:

- An error thrown inside `events.timer` / `events.nonHttp` propagates and fails
  the invocation — it is never converted into a `500` HTTP response.
- `onUnhandledEvent` only governs invocations **without** a matching handler:
  `'error'` (default) throws `UnsupportedEventError`; `'ignore'` restores the
  historical permissive dispatch. An explicit handler always wins.

| Invocation                                 | With matching `events` handler | Default (`'error'`)                        | `'ignore'`                 |
| ------------------------------------------ | ------------------------------ | ------------------------------------------ | -------------------------- |
| HTTP event                                 | handled by the framework       | handled by the framework                   | handled by the framework   |
| Timer event                                | `events.timer` (normalized)    | `UnsupportedEventError` — invocation fails | dispatched anyway (legacy) |
| Recognized non-HTTP event of another kind  | —                              | `UnsupportedEventError` — invocation fails | dispatched anyway (legacy) |
| Unrecognized event                         | `events.nonHttp` (raw)         | `UnsupportedEventError` — invocation fails | dispatched anyway (legacy) |

Failing the invocation matters: FC / SCF / Lambda only mark an invocation as
failed when the handler throws, which is what puts it into logs, alerts and the
platform's retry policy. `onUnhandledEvent: 'ignore'` exists only as a
deprecation escape hatch for code that relied on the previous permissive
behaviour.

What is recognized per provider:

| Provider          | Recognized timer envelope                                                                       | Notes                                                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aliyun FC3        | `{triggerTime, triggerName, payload}`                                                           | Delivered as a Buffer; plain objects (e.g. `si local`) are accepted as well                                                                                                                                              |
| Tencent SCF       | `{Type: 'Timer', TriggerName, Time, Message}`                                                    | —                                                                                                                                                                                                                       |
| Volcengine veFaaS | CloudEvents `{id, source: '/faas/event/timer/{timer_id}', type: 'faas.timer.event', time, data}` | `triggerName` is the timer id parsed from `source` (the event carries no trigger name), `triggerTime` is `time` and `payload` is `data`. The SCF-style envelope that `si local` emits is still accepted. TOS / MQ / TLS CloudEvents are `unknown` and reach `events.nonHttp` |
| AWS               | `{version, id, 'detail-type': 'Scheduled Event', source: 'aws.events', resources: [rule ARN]}`   | The rule name from `resources[0]` becomes `triggerName` (`id` as fallback) and `detail` becomes `payload`. An EventBridge **Scheduler** invoking the function with a custom input is indistinguishable from a hand-written event; it is reported as `unknown` and reaches `events.nonHttp` |
| Cloudflare        | —                                                                                               | Cron Triggers are delivered to the Worker's separate `scheduled()` export, which this adapter never sees — see [Cloudflare boundary](#cloudflare-boundary)                                                                |

What is recognized as an HTTP event, per provider:

| Provider          | HTTP fields                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aliyun FC3 / AWS  | API Gateway shapes: `path` / `rawPath` / `httpMethod` (v1), `version: '2.0'` + `rawPath` (v2), ALB (`requestContext.elb` + `httpMethod`)                                  |
| Tencent SCF       | Function URL (`httpMethod`, `path` optional) and the legacy API Gateway shape (`queryStringParameters` / `requestContext`)                                                 |
| Volcengine veFaaS | Documented API Gateway structure: `path` + `httpMethod` + `queryStringParameters` + `pathParameters`; the legacy `method` / `query` spelling is still accepted             |

### Cloudflare boundary

Cloudflare Workers separates the entrypoints at the runtime level: `fetch` and
`scheduled` are distinct exports the adapter cannot intercept. Compose them in
the Worker entrypoint instead:

```typescript
import serverlessAdapter from '@geek-fun/serverless-adapter';

const handler = serverlessAdapter(app);

export default {
  fetch: (request, env, ctx) => handler(request, ctx),
  scheduled: (controller, env, ctx) => runTimerJob({ /* your own shape */ }),
};
```

### Keeping your own entrypoint (manual recipe)

If you prefer to classify in your own entrypoint instead of registering
`events` handlers, the normalization is exported for reuse:

```typescript
import serverlessAdapter, { isTimerEvent, normalizeTimerEvent } from '@geek-fun/serverless-adapter';

const http = serverlessAdapter(app, { provider: 'aliyun' });

export const handler = async (event, context) => {
  // Pass the provider your deployment targets: without it, both helpers scan
  // every provider's markers and attribute the event to the first match.
  const timer = normalizeTimerEvent(event, 'aliyun');

  if (timer?.triggerName === 'billing-run') {
    return runBillingRun(timer);
  }

  if (isTimerEvent(event, 'aliyun')) {
    return someOtherTimer(event); // a timer, but not one this function handles
  }

  return http(event, context);
};
```

Classification is conservative: `http` only when the event positively matches a
known HTTP shape, `timer` only for a positively identified timer envelope,
everything else `unknown`. Never guess.

## Provider Detection

The adapter automatically detects the cloud provider by examining the `context` object:

| Provider   | Detection Fields                                         |
| ---------- | -------------------------------------------------------- |
| Aliyun     | `service.name`, `tracing`, `logger`, `function.memory`   |
| Tencent    | `tencentcloud_region`, `tencentcloud_appid`, `namespace` |
| Volcengine | `requestId`, `region`, `function.memoryMb`               |
| AWS        | `awsRequestId`, `invokedFunctionArn`, `functionName`     |
| Cloudflare | web `Request` event + `waitUntil` on context             |

## Contributing

Contributions are welcome! To work on the adapter locally:

```bash
git clone https://github.com/geek-fun/serverless-adapter.git
cd serverless-adapter
npm install
npm test           # runs Jest with coverage — 85% thresholds on all metrics are enforced
npm run lint:check # ESLint + Prettier
npm run build      # TypeScript build
```

Please include tests for any new code or bug fix — the coverage gates in
`jest.config.cjs` (85% statements / branches / functions / lines) must keep
passing. Open an issue first for larger changes so we can align on the design.

## Related Projects

- [ServerlessInsight](https://github.com/geek-fun/serverlessinsight) — define your serverless infrastructure in YAML and deploy it across Alibaba Cloud, Tencent Cloud, Huawei Cloud, and Volcengine. Pair it with this adapter: ServerlessInsight provisions the function and gateway, this adapter makes your framework app run on it.

## License

[Apache-2.0](LICENSE)

---

<div align="center">

English · [简体中文](README.zh-CN.md)

</div>
