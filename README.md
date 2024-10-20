# Serverless-Adapter

[![Node.js CI](https://github.com/geek-fun/serverless-adapter/actions/workflows/node.yml/badge.svg)](https://github.com/geek-fun/serverless-adapter/actions/workflows/node.yml)
[![release](https://github.com/geek-fun/serverless-adapter/actions/workflows/release.yml/badge.svg)](https://github.com/geek-fun/serverless-adapter/actions/workflows/release.yml)
[![npm version](https://badge.fury.io/js/@geek-fun%2Fserverless-adapter.svg)](https://badge.fury.io/js/@geek-fun%2Fserverless-adapter)
[![Known Vulnerabilities](https://snyk.io/test/github/geek-fun/serverless-adapter/badge.svg)](https://snyk.io/test/github/geek-fun/serverless-adapter)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![codecov](https://codecov.io/gh/geek-fun/serverless-adapter/graph/badge.svg?token=lw1AJuX9S9)](https://codecov.io/gh/geek-fun/serverless-adapter)

Adapter for web framework express, koa, springboot to run on top of serverless API Gateway and Functions cross different
cloud provider like aliyun, huawei

## Quick Start

### prerequisites

- Node.js >= 16.x

### Install

```bash
npm install -g @geek-fun/serverless-adapter
```

### Usage

```typescript
 const app = express();
export const handler = serverlessAdapter(app)
```
