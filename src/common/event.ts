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
