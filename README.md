# Serverless-Adapter

[![Node.js CI](https://github.com/geek-fun/serverless-adapter/actions/workflows/node.yml/badge.svg)](https://github.com/geek-fun/serverless-adapter/actions/workflows/node.yml)
[![release](https://github.com/geek-fun/serverless-adapter/actions/workflows/release.yml/badge.svg)](https://github.com/geek-fun/serverless-adapter/actions/workflows/release.yml)
[![npm version](https://badge.fury.io/js/@geek-fun%2Fserverless-adapter.svg)](https://badge.fury.io/js/@geek-fun%2Fserverless-adapter)
[![Known Vulnerabilities](https://snyk.io/test/github/geek-fun/serverless-adapter/badge.svg)](https://snyk.io/test/github/geek-fun/serverless-adapter)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![codecov](https://codecov.io/gh/geek-fun/serverless-adapter/graph/badge.svg?token=lw1AJuX9S9)](https://codecov.io/gh/geek-fun/serverless-adapter)

Adapter for web frameworks (Express, Koa) to run on serverless platforms across multiple cloud providers with automatic provider detection.

## Supported Cloud Providers

| Provider               | Service                         | Status       | Trigger Type |
| ---------------------- | ------------------------------- | ------------ | ------------ |
| Alibaba Cloud (Aliyun) | Function Compute                | ✅ Supported | API Gateway  |
| Tencent Cloud          | Serverless Cloud Function (SCF) | ✅ Supported | API Gateway  |
| Volcengine             | veFaaS (函数服务)               | ✅ Supported | API Gateway  |

## Supported Frameworks

| Framework | Version | Status       |
| --------- | ------- | ------------ |
| Express   | 4.x     | ✅ Supported |
| Express   | 5.x     | ✅ Supported |
| Koa       | 2.x     | ✅ Supported |
| Koa       | 3.x     | ✅ Supported |

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

## API Reference

### `serverlessAdapter(app, options?)`

Creates a serverless handler for your Express or Koa application.

#### Parameters

| Parameter          | Type                                    | Required | Description                                                  |
| ------------------ | --------------------------------------- | -------- | ------------------------------------------------------------ |
| `app`              | `Express \| Koa`                        | Yes      | Express or Koa application instance                          |
| `options.provider` | `'aliyun' \| 'tencent' \| 'volcengine'` | No       | Explicitly specify cloud provider (auto-detected if omitted) |

#### Returns

A function that handles serverless events:

```typescript
(event: Buffer, context: ProviderContext) =>
  Promise<{
    statusCode: number;
    body: string;
    headers: Record<string, string>;
    isBase64Encoded: boolean;
  }>;
```

## Provider Detection

The adapter automatically detects the cloud provider by examining the `context` object:

| Provider   | Detection Fields                                         |
| ---------- | -------------------------------------------------------- |
| Aliyun     | `service.name`, `tracing`, `logger`, `function.memory`   |
| Tencent    | `tencentcloud_region`, `tencentcloud_appid`, `namespace` |
| Volcengine | `requestId`, `region`, `function.memoryMb`               |

## License

[Apache-2.0](LICENSE)
