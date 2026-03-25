// eslint-disable-next-line @typescript-eslint/no-require-imports
import Koa = require('koa');

declare module 'koa3' {
  export = Koa;
}
