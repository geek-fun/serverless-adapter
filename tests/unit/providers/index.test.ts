import {
  getProvider,
  detectProvider,
  getAllProviders,
  AliyunProvider,
  TencentProvider,
  VolcengineProvider,
} from '../../../src/providers';
import { defaultContext } from '../../fixtures/fcContext';
import { createTencentContext, createTencentEvent } from '../../fixtures/tencentContext';
import { createVolcengineContext, createVolcengineEvent } from '../../fixtures/volcengineContext';
import { AliyunApiGatewayContext } from '../../../src/types/aliyun';
import { VolcengineVefaasContext } from '../../../src/types/volcengine';

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

    it('should return VolcengineProvider for "volcengine"', () => {
      const provider = getProvider('volcengine');
      expect(provider).toBeInstanceOf(VolcengineProvider);
    });

    it('should return undefined for unknown provider', () => {
      const provider = getProvider('unknown' as 'aliyun' | 'tencent' | 'volcengine');
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

    it('should detect Volcengine provider', () => {
      const rawEvent = Buffer.from(JSON.stringify(createVolcengineEvent()));
      const context = createVolcengineContext();
      const provider = detectProvider(rawEvent, context);
      expect(provider?.name).toBe('volcengine');
    });

    it('should return undefined when no provider matches', () => {
      const rawEvent = Buffer.from(JSON.stringify({}));
      const context = { unknown: true };
      const provider = detectProvider(rawEvent, context as unknown as VolcengineVefaasContext);
      expect(provider).toBeUndefined();
    });
  });

  describe('getAllProviders', () => {
    it('should return map of all providers', () => {
      const providers = getAllProviders();
      expect(providers.size).toBe(3);
      expect(providers.has('aliyun')).toBe(true);
      expect(providers.has('tencent')).toBe(true);
      expect(providers.has('volcengine')).toBe(true);
    });
  });
});
