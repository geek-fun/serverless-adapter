import { Express } from 'express';
import Application from 'koa';
import serverlessAdapter from '../../src';
import { Context } from '../../src/types';

export const sendRequest = async (
  app: Express | Application,
  event: Record<string, unknown>,
  context: Record<string, unknown>,
) => {
  return serverlessAdapter(app)(
    {
      type: 'Buffer',
      data: Buffer.from(JSON.stringify(event)),
    },
    context as Context,
  );
};
