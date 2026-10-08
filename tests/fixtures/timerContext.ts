/**
 * Non-HTTP invocations, as the platforms actually deliver them to the function
 * handler (issue #22). Kept next to the HTTP fixtures so provider and adapter
 * tests exercise the same shapes.
 */

/** Aliyun FC3 time trigger: `{triggerTime, triggerName, payload}`, delivered as a Buffer. */
export const aliyunTimerEvent = Buffer.from(
  JSON.stringify({
    triggerTime: '2026-10-01T03:23:00Z',
    triggerName: 'billing-run',
    payload: '{"job":"billing-run"}',
  }),
);

/** The same Aliyun timer event, already parsed (si local and some tooling hand it over as an object). */
export const aliyunTimerEventObject = {
  triggerTime: '2026-10-01T03:23:00Z',
  triggerName: 'billing-run',
  payload: '{"job":"billing-run"}',
};

/** Tencent SCF time trigger: `{Type: 'Timer', TriggerName, Time, Message}`. */
export const tencentTimerEvent = Buffer.from(
  JSON.stringify({
    Type: 'Timer',
    TriggerName: 'billing-run',
    Time: '2026-10-01T03:23:00Z',
    Message: '{"job":"billing-run"}',
  }),
);

/** AWS EventBridge scheduled rule. */
export const awsScheduledEvent = {
  version: '0',
  id: '6c2b1b0a-0000-0000-0000-000000000001',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: '2026-10-01T03:23:00Z',
  region: 'us-east-1',
  resources: ['arn:aws:events:us-east-1:123456789012:rule/billing-run'],
  detail: {},
};

/**
 * Volcengine veFaaS timer, as serverlessinsight generates it: the Tencent-shape
 * `{Type: 'Timer', …}` envelope (the real platform envelope is not verified yet).
 */
export const volcengineTimerEvent = Buffer.from(
  JSON.stringify({
    Type: 'Timer',
    TriggerName: 'billing-run',
    Time: '2026-10-01T03:23:00Z',
    Message: '{"job":"billing-run"}',
  }),
);

/**
 * An EventBridge **Scheduler** invocation with a custom input: it carries no
 * recognizable marker and is indistinguishable from a hand-written event, so it
 * must stay `unknown` (issue #23).
 */
export const awsSchedulerCustomInputEvent = {
  jobId: 'billing-run',
  scheduledAt: '2026-10-01T03:23:00Z',
};

/** An event that matches no known envelope at all (e.g. a queue message). */
export const unknownEvent = Buffer.from(JSON.stringify({ foo: 'bar', Records: [] }));
