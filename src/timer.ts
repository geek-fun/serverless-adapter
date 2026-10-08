import { CloudProvider, ProviderEvent, TimerEvent } from './types';
import { getAllProviders, getProvider } from './providers';

/**
 * Parse a raw platform invocation into the normalized `TimerEvent` envelope
 * (issue #23), for projects that keep their own entrypoint and classify before
 * dispatching.
 *
 * Classification is provider-scoped: with an explicit `provider`, only that
 * provider's timer envelope is evaluated. Without one, every registered
 * provider's positive markers are tried — the envelopes are conservative enough
 * that an HTTP event of one provider is never claimed as another provider's
 * timer, but passing the provider is recommended for exactness.
 *
 * @returns the normalized `TimerEvent`, or `null` when the event does not
 *   positively match the provider's timer envelope.
 */
export const normalizeTimerEvent = (
  event: unknown,
  provider?: CloudProvider,
): TimerEvent | null => {
  if (provider) {
    return getProvider(provider)?.normalizeTimerEvent?.(event as ProviderEvent) ?? null;
  }

  for (const registered of getAllProviders().values()) {
    const normalized = registered.normalizeTimerEvent?.(event as ProviderEvent);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

/**
 * Whether a raw platform invocation is a positively identified timer trigger
 * event. Provider-scoped like `normalizeTimerEvent`; without a `provider`,
 * every registered provider's markers are tried.
 */
export const isTimerEvent = (event: unknown, provider?: CloudProvider): boolean =>
  normalizeTimerEvent(event, provider) !== null;
