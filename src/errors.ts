import { EventKind } from './types';
import { decodeRawEvent } from './common';

/** Invocation kinds this adapter cannot answer — see issue #22. */
export type UnsupportedEventKind = Exclude<EventKind, 'http'>;

export interface UnsupportedEventErrorOptions {
  provider: string;
  kind: UnsupportedEventKind;
  /** Provider-specific hint, e.g. the timer trigger name. */
  detail?: string;
  /** Top-level keys of the raw event — enough to debug without logging payloads. */
  eventKeys?: string[];
}

/**
 * Thrown when an invocation is not an HTTP event (timer trigger, queue event, …).
 *
 * The invocation is deliberately failed instead of being answered by the web
 * framework: FC/SCF/Lambda only mark an invocation as failed when the handler
 * throws, and a non-HTTP invocation that "succeeds" without doing its work is
 * invisible until someone notices the job never ran (issue #22).
 */
export class UnsupportedEventError extends Error {
  readonly provider: string;
  readonly kind: UnsupportedEventKind;
  readonly detail?: string;
  readonly eventKeys: string[];

  constructor({ provider, kind, detail, eventKeys = [] }: UnsupportedEventErrorOptions) {
    const detailText = detail ? ` (trigger "${detail}")` : '';
    const keysText = eventKeys.length > 0 ? ` Event keys: ${eventKeys.join(', ')}.` : '';
    super(
      `Unsupported ${kind} invocation for provider "${provider}"${detailText}: this adapter only handles HTTP events. ` +
        `Handle non-HTTP triggers in your own entrypoint, or pass { onUnhandledEvent: 'ignore' } to keep the previous behaviour.${keysText}`,
    );

    this.name = 'UnsupportedEventError';
    this.provider = provider;
    this.kind = kind;
    this.detail = detail;
    this.eventKeys = eventKeys;
  }
}

/**
 * Top-level keys of a raw invocation, used to make an `UnsupportedEventError`
 * actionable without dumping the payload (which may carry user data) into logs.
 */
export const eventKeysOf = (event: unknown): string[] => {
  const parsed = decodeRawEvent(event);

  if (Array.isArray(parsed)) {
    return ['<array>'];
  }

  if (parsed !== null && typeof parsed === 'object') {
    return Object.keys(parsed);
  }

  return [];
};
