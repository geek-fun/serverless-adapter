/**
 * Decode a raw invocation for inspection: Buffer / JSON-string events are
 * parsed, anything else is passed through untouched. An undecodable Buffer or
 * string yields `undefined` (passing the Buffer through would expose byte
 * indices as "keys"), so callers decide what "not an object" means for them
 * (`parseEventPayload` → undefined / `eventKeysOf` → no keys).
 */
export const decodeRawEvent = (event: unknown): unknown => {
  if (Buffer.isBuffer(event) || typeof event === 'string') {
    try {
      return JSON.parse(Buffer.isBuffer(event) ? event.toString() : event);
    } catch {
      return undefined;
    }
  }

  return event;
};

/**
 * Normalize a timer payload for the `TimerEvent` envelope (issue #23):
 * JSON-parsed when parseable, otherwise the raw string. Buffers are decoded
 * first — Aliyun FC3 delivers the timer payload as a Buffer in practice.
 * Non-string payloads (objects, numbers) pass through untouched.
 */
export const decodeTimerPayload = (payload: unknown): unknown => {
  if (Buffer.isBuffer(payload)) {
    const text = payload.toString();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  return payload;
};
