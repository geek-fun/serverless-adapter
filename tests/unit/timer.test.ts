import { isTimerEvent, normalizeTimerEvent, CloudProvider } from '../../src/index';
import {
  aliyunTimerEvent,
  aliyunTimerEventObject,
  awsScheduledEvent,
  awsSchedulerCustomInputEvent,
  tencentTimerEvent,
  unknownEvent,
  volcengineSiLocalTimerEvent,
  volcengineTimerEvent,
} from '../fixtures/timerContext';

describe('normalizeTimerEvent (issue #23)', () => {
  describe('aliyun', () => {
    it('should normalize the FC3 time-trigger envelope delivered as a Buffer', () => {
      expect(normalizeTimerEvent(aliyunTimerEvent)).toEqual({
        provider: 'aliyun',
        triggerName: 'billing-run',
        triggerTime: '2026-10-01T03:23:00Z',
        payload: { job: 'billing-run' },
        raw: aliyunTimerEvent,
      });
    });

    it('should normalize the same envelope handed over as a parsed object (si local)', () => {
      expect(normalizeTimerEvent(aliyunTimerEventObject)).toEqual({
        provider: 'aliyun',
        triggerName: 'billing-run',
        triggerTime: '2026-10-01T03:23:00Z',
        payload: { job: 'billing-run' },
        raw: aliyunTimerEventObject,
      });
    });

    it('should normalize the envelope handed over as a JSON string', () => {
      const raw = JSON.stringify({
        triggerTime: '2026-10-01T03:23:00Z',
        triggerName: 'billing-run',
      });

      expect(normalizeTimerEvent(raw)).toEqual({
        provider: 'aliyun',
        triggerName: 'billing-run',
        triggerTime: '2026-10-01T03:23:00Z',
        raw,
      });
    });

    it('should keep an unparseable payload as the raw string', () => {
      const normalized = normalizeTimerEvent({
        triggerName: 'billing-run',
        payload: 'not json at all',
      });

      expect(normalized?.payload).toBe('not json at all');
    });

    it('should parse a Buffer payload (FC delivers it as a Buffer in practice)', () => {
      const normalized = normalizeTimerEvent({
        triggerName: 'billing-run',
        payload: Buffer.from(JSON.stringify({ job: 'billing-run' })),
      });

      expect(normalized?.payload).toEqual({ job: 'billing-run' });
    });

    it('should keep an undecodable Buffer payload as its string form', () => {
      const bufferPayload = Buffer.from('not json');
      const normalized = normalizeTimerEvent({
        triggerName: 'billing-run',
        payload: bufferPayload,
      });

      expect(normalized?.payload).toBe('not json');
    });

    it('should pass through object payloads untouched', () => {
      const payload = { job: 'billing-run', nested: { a: 1 } };
      const normalized = normalizeTimerEvent({ triggerName: 'billing-run', payload });

      expect(normalized?.payload).toBe(payload);
    });

    it('should omit absent optional fields', () => {
      expect(normalizeTimerEvent({ triggerName: 'billing-run' })).toEqual({
        provider: 'aliyun',
        triggerName: 'billing-run',
        raw: { triggerName: 'billing-run' },
      });
    });

    it('should not claim an HTTP-shaped event as a timer', () => {
      const httpEvent = Buffer.from(
        JSON.stringify({ path: '/', httpMethod: 'GET', triggerName: 'not-a-timer' }),
      );

      expect(normalizeTimerEvent(httpEvent)).toBeNull();
    });

    it('should reject undecodable events', () => {
      expect(normalizeTimerEvent(Buffer.from('not json'))).toBeNull();
      expect(normalizeTimerEvent(['not', 'an', 'object'])).toBeNull();
    });
  });

  describe('tencent', () => {
    it('should normalize the SCF time-trigger envelope', () => {
      expect(normalizeTimerEvent(tencentTimerEvent)).toEqual({
        provider: 'tencent',
        triggerName: 'billing-run',
        triggerTime: '2026-10-01T03:23:00Z',
        payload: { job: 'billing-run' },
        raw: tencentTimerEvent,
      });
    });

    it('should normalize the envelope handed over as an object', () => {
      const raw = { Type: 'Timer', TriggerName: 'billing-run', Time: '2026-10-01T03:23:00Z' };

      expect(normalizeTimerEvent(raw)).toEqual({
        provider: 'tencent',
        triggerName: 'billing-run',
        triggerTime: '2026-10-01T03:23:00Z',
        raw,
      });
    });

    it('should keep an unparseable Message as the raw string', () => {
      const normalized = normalizeTimerEvent({
        Type: 'Timer',
        TriggerName: 'billing-run',
        Message: 'plain text message',
      });

      expect(normalized?.payload).toBe('plain text message');
    });

    it('should not claim events without the positive Timer marker', () => {
      expect(normalizeTimerEvent({ Type: 'Queue', TriggerName: 'billing-run' })).toBeNull();
      expect(normalizeTimerEvent(unknownEvent)).toBeNull();
    });
  });

  describe('volcengine', () => {
    it('should normalize the documented CloudEvents timer envelope', () => {
      expect(normalizeTimerEvent(volcengineTimerEvent, 'volcengine')).toEqual({
        provider: 'volcengine',
        triggerName: '4o3fw1qf****', // the timer id from `source`
        triggerTime: '2022-11-22T04:28:07.945838513Z',
        payload: { job: 'billing-run' },
        raw: volcengineTimerEvent,
      });
    });

    it('should normalize a CloudEvents timer without source or data', () => {
      const minimal = Buffer.from(JSON.stringify({ type: 'faas.timer.event' }));

      expect(normalizeTimerEvent(minimal, 'volcengine')).toEqual({
        provider: 'volcengine',
        raw: minimal,
      });
    });

    it('should keep the SCF-style envelope of `si local` working', () => {
      expect(normalizeTimerEvent(volcengineSiLocalTimerEvent, 'volcengine')).toEqual({
        provider: 'volcengine',
        triggerName: 'billing-run',
        triggerTime: '2026-10-01T03:23:00Z',
        payload: { job: 'billing-run' },
        raw: volcengineSiLocalTimerEvent,
      });
    });

    it('should not claim HTTP-shaped events, nor other CloudEvents kinds', () => {
      const httpEvent = Buffer.from(JSON.stringify({ path: '/', method: 'GET' }));
      const documentedHttpEvent = Buffer.from(
        JSON.stringify({ path: '/', httpMethod: 'GET', queryStringParameters: {} }),
      );
      const tosEvent = Buffer.from(
        JSON.stringify({ type: 'faas.tos.event', source: '/faas/event/tos/bucket' }),
      );

      expect(normalizeTimerEvent(httpEvent, 'volcengine')).toBeNull();
      expect(normalizeTimerEvent(documentedHttpEvent, 'volcengine')).toBeNull();
      expect(normalizeTimerEvent(tosEvent, 'volcengine')).toBeNull();
    });
  });

  describe('aws', () => {
    it('should normalize the EventBridge scheduled-rule envelope', () => {
      expect(normalizeTimerEvent(awsScheduledEvent)).toEqual({
        provider: 'aws',
        triggerName: 'billing-run',
        triggerTime: '2026-10-01T03:23:00Z',
        payload: {},
        raw: awsScheduledEvent,
      });
    });

    it('should fall back to the invocation id when there is no rule ARN', () => {
      const raw = { 'detail-type': 'Scheduled Event', source: 'aws.events', id: 'abc-123' };

      expect(normalizeTimerEvent(raw)).toEqual({
        provider: 'aws',
        triggerName: 'abc-123',
        raw,
      });
    });

    it('should not claim an EventBridge Scheduler custom input', () => {
      expect(normalizeTimerEvent(awsSchedulerCustomInputEvent)).toBeNull();
    });

    it('should not claim an HTTP event', () => {
      const apiGatewayEvent = {
        version: '2.0',
        routeKey: 'GET /',
        rawPath: '/',
        headers: {},
        requestContext: { http: { method: 'GET' } },
      };

      expect(normalizeTimerEvent(apiGatewayEvent)).toBeNull();
    });
  });

  describe('cloudflare', () => {
    it('should never report a timer (Cron Triggers never reach the adapter)', () => {
      const request = new Request('https://example.com/');

      expect(normalizeTimerEvent(request, 'cloudflare')).toBeNull();
      expect(isTimerEvent(request, 'cloudflare')).toBe(false);
    });
  });

  describe('provider scoping', () => {
    it('should evaluate only the requested provider envelope', () => {
      expect(normalizeTimerEvent(aliyunTimerEvent, 'aliyun')).not.toBeNull();
      expect(normalizeTimerEvent(aliyunTimerEvent, 'tencent')).toBeNull();
      expect(normalizeTimerEvent(aliyunTimerEvent, 'aws')).toBeNull();
      expect(normalizeTimerEvent(tencentTimerEvent, 'aliyun')).toBeNull();
      expect(normalizeTimerEvent(tencentTimerEvent, 'volcengine')).not.toBeNull();
      expect(normalizeTimerEvent(awsScheduledEvent, 'tencent')).toBeNull();
    });

    it('should return null for an unknown provider name', () => {
      expect(normalizeTimerEvent(aliyunTimerEvent, 'nope' as CloudProvider)).toBeNull();
    });

    it('should attribute each envelope to its own provider without a provider argument', () => {
      expect(normalizeTimerEvent(aliyunTimerEvent)?.provider).toBe('aliyun');
      expect(normalizeTimerEvent(tencentTimerEvent)?.provider).toBe('tencent');
      expect(normalizeTimerEvent(volcengineTimerEvent, 'volcengine')?.provider).toBe('volcengine');
      expect(normalizeTimerEvent(awsScheduledEvent)?.provider).toBe('aws');
    });

    it('should return null without a provider when nothing matches', () => {
      expect(normalizeTimerEvent(unknownEvent)).toBeNull();
      expect(normalizeTimerEvent(awsSchedulerCustomInputEvent)).toBeNull();
      expect(normalizeTimerEvent(undefined)).toBeNull();
      expect(normalizeTimerEvent(42)).toBeNull();
    });
  });
});

describe('isTimerEvent (issue #23)', () => {
  it('should be true for every positively identified timer envelope', () => {
    expect(isTimerEvent(aliyunTimerEvent, 'aliyun')).toBe(true);
    expect(isTimerEvent(aliyunTimerEventObject)).toBe(true);
    expect(isTimerEvent(tencentTimerEvent, 'tencent')).toBe(true);
    expect(isTimerEvent(volcengineTimerEvent, 'volcengine')).toBe(true);
    expect(isTimerEvent(awsScheduledEvent, 'aws')).toBe(true);
  });

  it('should be false for HTTP events, unknown events and undecodable payloads', () => {
    const httpEvent = Buffer.from(JSON.stringify({ path: '/', httpMethod: 'GET' }));

    expect(isTimerEvent(httpEvent, 'aliyun')).toBe(false);
    expect(isTimerEvent(unknownEvent, 'aliyun')).toBe(false);
    expect(isTimerEvent(Buffer.from('not json'), 'tencent')).toBe(false);
    expect(isTimerEvent(awsSchedulerCustomInputEvent, 'aws')).toBe(false);
  });

  it('should respect the provider scope', () => {
    expect(isTimerEvent(aliyunTimerEvent, 'tencent')).toBe(false);
    expect(isTimerEvent(aliyunTimerEvent)).toBe(true);
  });
});
