import serverlessAdapter from '../../src';
import { Context } from '../../src/types';

export const sendRequest = async (
  app: unknown,
  event: Record<string, unknown>,
  context: Record<string, unknown>,
) => {
  return serverlessAdapter(app as Parameters<typeof serverlessAdapter>[0])(
    Buffer.from(JSON.stringify(event)),
    context as Context,
  );
};
