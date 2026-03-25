import {
  getProvider,
  detectProvider,
  getAllProviders,
  AliyunProvider,
  TencentProvider,
} from '../../../src/providers';
import { defaultContext } from '../../fixtures/fcContext';
import { createTencentContext, createTencentEvent } from '../../fixtures/tencentContext';
import { AliyunApiGatewayContext } from '../../../src/types/aliyun';
import { TencentScfContext } from '../../../src/types/tencent';

describe('providers/index', () => {
  describe('getProvider', () => {
    it('should return AliyunProvider for "aliyun"', () => {
      const provider = getProvider('aliyun');
      expect(provider).toBeInstanceOf(AliyunProvider);
    });

    it('should return TencentProvider for "tencent"', () => {
      const provider = getProvider('tencent');
      expect(provider).toBeInstanceOf(TencentProvider);
    });

    it('should return undefined for unknown provider', () => {
      const provider = getProvider('unknown' as 'aliyun' | 'tencent');
      expect(provider).toBeUndefined();
    });
  });

  describe('detectProvider', () => {
    it('should detect Aliyun provider', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const provider = detectProvider(rawEvent, defaultContext as AliyunApiGatewayContext);
      expect(provider?.name).toBe('aliyun');
    });

    it('should detect Tencent provider', () => {
      const rawEvent = Buffer.from(JSON.stringify(createTencentEvent()));
      const context = createTencentContext();
      const provider = detectProvider(rawEvent, context);
      expect(provider?.name).toBe('tencent');
    });

    it('should return undefined when no provider matches', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = { unknown: true };
      const provider = detectProvider(rawEvent, context as unknown as TencentScfContext);
      expect(provider).toBeUndefined();
    });
  });

  describe('getAllProviders', () => {
    it('should return map of all providers', () => {
      const providers = getAllProviders();
      expect(providers.size).toBe(2);
      expect(providers.has('aliyun')).toBe(true);
      expect(providers.has('tencent')).toBe(true);
    });
  });
});
