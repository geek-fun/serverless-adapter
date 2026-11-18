/**
 * ServerlessInsight runtime config SDK (epic #53 P2 / ADR-006).
 *
 * Deploy injects `SI_CONFIG_TOKEN` (a `sirt_` runtime key bound to the
 * function's service+stage) and `SI_CONSOLE_URL`; `siConfig.init()` prefetches
 * the merged config snapshot in parallel with handler cold-start, caches it in
 * memory (default 60s TTL) and serves `get` / `getSecret` / `snapshot` from the
 * cached view. Failed refreshes keep serving the last-good snapshot — a
 * transient SaaS outage never takes the function down.
 *
 * Local mode: when `SI_CONFIG_TOKEN` is absent, `si local`'s snapshot file
 * (`.serverlessinsight/local-config.json`) is read directly.
 */

import fs from 'node:fs';
import path from 'node:path';

export type SiConfigEntry = {
  key: string;
  value: string;
  secret: boolean;
  source?: { name: string; versionNumber: number; scope: string };
};

export type SiConfigSnapshot = {
  stage?: string;
  snapshotVersion: number;
  entries: SiConfigEntry[];
};

export type SiConfigOptions = {
  /** Console base URL; defaults to SI_CONSOLE_URL (deploy-injected). */
  consoleUrl?: string;
  /** Runtime key; defaults to SI_CONFIG_TOKEN (deploy-injected). */
  token?: string;
  /** Snapshot cache TTL in ms (default 60_000). */
  ttlMs?: number;
  /** Keys to include in the fetch (server-side filter). */
  include?: string[];
  /** Fetch injection for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Disable the local snapshot file fallback (default false). */
  disableLocalFile?: boolean;
};

export type SiRuntime = {
  /** Raw value of a config item (`<set>.<key>` — the same shape as
   * `${config_sets.…}` refs). Throws when the key is absent. */
  get: (key: string) => Promise<string | number | boolean>;
  /** Value of a secret item — decrypted server-side, never cached beyond the
   * snapshot's TTL. Throws when the key is absent. */
  getSecret: (key: string) => Promise<string>;
  /** Consistent view for one snapshotVersion. */
  snapshot: () => Promise<SiConfigSnapshot>;
  /** Force a refresh ignoring the cache TTL. */
  refresh: () => Promise<void>;
};

const LOCAL_SNAPSHOT_PATH = '.serverlessinsight/local-config.json';
const DEFAULT_TTL_MS = 60_000;

export const siConfig = {
  /**
   * Async prefetch — call it during module init so the fetch overlaps handler
   * cold-start. Never throws: a failed first fetch still yields a runtime
   * whose reads fail loudly (or fall back to the local file), and handlers
   * stay constructible.
   */
  init: (options?: SiConfigOptions): SiRuntime => {
    const consoleUrl = options?.consoleUrl ?? process.env['SI_CONSOLE_URL'] ?? '';
    const token = options?.token ?? process.env['SI_CONFIG_TOKEN'] ?? '';
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const fetchImpl = options?.fetchImpl ?? fetch;
    const disableLocalFile = options?.disableLocalFile ?? false;

    let cached: SiConfigSnapshot | null = null;
    let cachedAt = 0;
    let inFlight: Promise<void> | null = null;

    const readLocalSnapshot = (): SiConfigSnapshot | null => {
      if (disableLocalFile) return null;
      try {
        // The local file only exists when `si local` resolved config refs in
        // this project — missing/corrupt files simply mean no local snapshot.
        const file = path.resolve(process.cwd(), LOCAL_SNAPSHOT_PATH);
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as SiConfigSnapshot;
      } catch {
        return null;
      }
    };

    const fetchSnapshot = async (): Promise<SiConfigSnapshot> => {
      const response = await fetchImpl(`${consoleUrl.replace(/\/$/, '')}/api/v1/runtime/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(options?.include ? { body: JSON.stringify({ include: options.include }) } : {}),
      });
      if (!response.ok) {
        throw new Error(`SI runtime config fetch failed: HTTP ${response.status}`);
      }
      const body = (await response.json()) as { code: number; data?: SiConfigSnapshot };
      if (!body.data) throw new Error('SI runtime config response missing data');
      return body.data;
    };

    const ensureFresh = async (): Promise<SiConfigSnapshot> => {
      if (cached && Date.now() - cachedAt < ttlMs) return cached;
      if (!inFlight) {
        inFlight = (async () => {
          try {
            if (!consoleUrl || !token) {
              const local = readLocalSnapshot();
              if (local) {
                cached = local;
                cachedAt = Date.now();
                return;
              }
              throw new Error(
                'SI runtime config is not configured — deploy with config refs to inject SI_CONFIG_TOKEN, or run `si local` for the local snapshot',
              );
            }
            cached = await fetchSnapshot();
            cachedAt = Date.now();
          } finally {
            inFlight = null;
          }
        })();
      }
      try {
        await inFlight;
      } catch (error) {
        // Last-good fallback: a stale snapshot beats a hard failure at read
        // time; the error surfaces only when there has never been a snapshot.
        if (!cached) throw error;
      }
      return cached!;
    };

    const lookup = (snapshot: SiConfigSnapshot, key: string): SiConfigEntry | undefined =>
      snapshot.entries.find((entry) => entry.key === key);

    return {
      get: async (key) => {
        const snapshot = await ensureFresh();
        const entry = lookup(snapshot, key);
        if (entry === undefined) {
          throw new Error(
            `SI config key "${key}" not found in snapshot v${snapshot.snapshotVersion}`,
          );
        }
        const raw = entry.value;
        if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        return raw;
      },
      getSecret: async (key) => {
        const snapshot = await ensureFresh();
        const entry = lookup(snapshot, key);
        if (entry === undefined) {
          throw new Error(
            `SI config key "${key}" not found in snapshot v${snapshot.snapshotVersion}`,
          );
        }
        return entry.value;
      },
      snapshot: async () => ensureFresh(),
      refresh: async () => {
        cached = null;
        cachedAt = 0;
        await ensureFresh();
      },
    };
  },
};
