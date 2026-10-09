import serverlessAdapter from '../../src';
import { Context, FrameworkApp } from '../../src/types';

export const sendRequest = async (
  app: unknown,
  event: Record<string, unknown>,
  context: Record<string, unknown>,
) => {
  // Positional form explicitly: with the symmetric overload present,
  // `Parameters<typeof serverlessAdapter>[0]` resolves to the options object.
  const handler = serverlessAdapter(app as FrameworkApp);

  return handler(Buffer.from(JSON.stringify(event)), context as Context);
};
