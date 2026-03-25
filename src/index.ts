import { Express } from 'express';
import Application from 'koa';
import { IncomingHttpHeaders } from 'http';
import { constructFramework } from './framework';
import { waitForStreamComplete, buildResponse } from './transport';
import { detectProvider, getProvider } from './providers';
import { debug } from './common';
import { CloudProvider, ProviderEvent, ProviderContext, ServerlessResponse } from './types';

export interface ServerlessAdapterOptions {
  provider?: CloudProvider;
}

type HandlerResult = {
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
  isBase64Encoded: boolean;
};

type Handler = (event: ProviderEvent, context: ProviderContext) => Promise<HandlerResult>;

const serverlessAdapter = (
  app: Express | Application,
  options?: ServerlessAdapterOptions,
): Handler => {
  const serverlessFramework = constructFramework(app);

  return async (event: ProviderEvent, context: ProviderContext): Promise<HandlerResult> => {
    debug(`serverlessAdapter receive event: ${JSON.stringify({ event, context })}`);

    const provider = options?.provider
      ? getProvider(options.provider)
      : detectProvider(event, context);

    if (!provider) {
      throw new Error('Unable to detect cloud provider. Please specify provider option.');
    }

    debug(`serverlessAdapter: Using provider: ${provider.name}`);

    try {
      const normalizedEvent = provider.normalizeEvent(event);
      const { request, isBase64Encoded } = provider.createRequest(normalizedEvent);

      debug(`serverlessAdapter normalizedEvent: ${JSON.stringify(normalizedEvent)}`);

      const response = await serverlessFramework(request);
      await waitForStreamComplete(response);

      const builtResponse = buildResponse({ request, response });
      const formattedResponse = provider.formatResponse({
        ...builtResponse,
        isBase64Encoded,
      } as ServerlessResponse) as HandlerResult;

      return formattedResponse;
    } catch (err) {
      return {
        statusCode: 500,
        body: (err as Error).message,
        headers: {},
        isBase64Encoded: false,
      };
    }
  };
};

export default serverlessAdapter;

export * from './types';
export * from './providers';
