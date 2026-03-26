import { ServerlessProvider } from './base';
import { AliyunProvider } from './aliyun';
import { TencentProvider } from './tencent';
import { VolcengineProvider } from './volcengine';
import { CloudProvider, ProviderContext, ProviderEvent } from '../types';

const providers: Map<CloudProvider, ServerlessProvider> = new Map();

export function registerProvider(provider: ServerlessProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: CloudProvider): ServerlessProvider | undefined {
  return providers.get(name);
}

export function detectProvider(
  rawEvent: ProviderEvent,
  rawContext: ProviderContext,
): ServerlessProvider | undefined {
  for (const provider of providers.values()) {
    if (provider.detect(rawEvent, rawContext)) {
      return provider;
    }
  }
  return undefined;
}

export function getAllProviders(): Map<CloudProvider, ServerlessProvider> {
  return new Map(providers);
}

registerProvider(new AliyunProvider());
registerProvider(new TencentProvider());
registerProvider(new VolcengineProvider());

export { ServerlessProvider } from './base';
export { AliyunProvider } from './aliyun';
export { TencentProvider } from './tencent';
export { VolcengineProvider } from './volcengine';
