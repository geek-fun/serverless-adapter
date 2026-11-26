/**
 * ServerlessInsight runtime ConfigSet SDK (epic #53 P2 / ADR-006).
 *
 * Deploy injects `SI_CONFIG_TOKEN` (a `sirt_` runtime key bound to the
 * function's service+stage) and `SI_CONSOLE_URL`; `createConfigSet()` starts a
 * non-blocking prefetch in parallel with handler cold-start, caches the merged
 * snapshot in memory (default 60s TTL) and serves `get` / `getSecret` /
 * `snapshot` from the cached view. Failed refreshes keep serving the last-good
 * snapshot with backoff — a transient SaaS outage never takes the function down.
 *
 * Local mode: when `SI_CONFIG_TOKEN` is absent, `si local`'s snapshot file
 * (`.serverlessinsight/local-config.json`) is read directly on Node runtimes.
 */

export type ConfigSetItemType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'yaml'
  | 'text'
  | 'secret';

export type ConfigSetSource = {
  readonly configSetId?: string;
  readonly name: string;
  readonly versionNumber: number;
  readonly scope: string;
};

export type ConfigSetEntry = {
  readonly key: string;
  readonly value: string;
  readonly type?: ConfigSetItemType;
  readonly secret: boolean;
  readonly source?: ConfigSetSource;
};

export type ConfigSetSnapshot = {
  readonly stage?: string;
  readonly snapshotVersion: number;
  readonly entries: readonly ConfigSetEntry[];
};

export type ConfigSetValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export type ConfigSetOptions = {
  /** Console base URL; defaults to SI_CONSOLE_URL (deploy-injected). */
  readonly consoleUrl?: string;
  /** Runtime key; defaults to SI_CONFIG_TOKEN (deploy-injected). */
  readonly token?: string;
  /** Snapshot cache TTL in ms (default 60_000). */
  readonly ttlMs?: number;
  /** Fetch timeout in ms before aborting and falling back (default 5_000). */
  readonly timeoutMs?: number;
  /** Retry backoff in ms after a failed refresh when serving a cached snapshot (default 5_000). */
  readonly retryBackoffMs?: number;
  /** Keys to include in the snapshot (applied both server-side and in local mode). */
  readonly include?: readonly string[];
  /** Start a non-blocking prefetch on creation when credentials exist (default true). */
  readonly prefetch?: boolean;
  /** Fetch injection for tests or custom runtimes; defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Disable the local snapshot file fallback (default false). */
  readonly disableLocalFile?: boolean;
  /** Override the local snapshot path (defaults to `<cwd>/.serverlessinsight/local-config.json`). */
  readonly localFilePath?: string;
};

export type ConfigSet = {
  /** Typed value of a config item (`<set>.<key>` — matches `${config_sets.…}`).
   * Respects `entry.type` (string/number/boolean/json/yaml/text/secret). Throws when absent. */
  readonly get: (key: string) => Promise<ConfigSetValue>;
  /** Raw decrypted string value of a secret item. Throws when absent. */
  readonly getSecret: (key: string) => Promise<string>;
  /** Immutable view of the current snapshot and its `snapshotVersion`. */
  readonly snapshot: () => Promise<ConfigSetSnapshot>;
  /** Force a fresh fetch ignoring TTL and backoff; keeps the last-good snapshot
   * intact for subsequent reads even if this refresh fails. */
  readonly refresh: () => Promise<void>;
};

type CacheState = {
  readonly snapshot: ConfigSetSnapshot | null;
  readonly fetchedAt: number;
  readonly retryAfter: number;
};

type NodeFsPath = {
  readonly existsSync: (filePath: string) => boolean;
  readonly readFileSync: (filePath: string, encoding: 'utf-8') => string;
  readonly resolve: (...parts: string[]) => string;
};

const LOCAL_SNAPSHOT_PATH = '.serverlessinsight/local-config.json';
const DEFAULT_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_BACKOFF_MS = 5_000;

const VALID_ITEM_TYPES = new Set<ConfigSetItemType>([
  'string',
  'number',
  'boolean',
  'json',
  'yaml',
  'text',
  'secret',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/* istanbul ignore next -- non-Node edge runtime guard */
const readEnv = (name: string): string =>
  typeof process !== 'undefined' && process.env ? (process.env[name] ?? '') : '';

/* istanbul ignore next -- dynamic Node-only fs/path loader for Cloudflare Workers compatibility */
const loadNodeFsPath = (): NodeFsPath | null => {
  if (typeof require !== 'function') return null;
  try {
    // Indirection keeps edge bundlers (e.g. Cloudflare Workers) from statically
    // pulling node:fs / node:path into non-Node bundles.
    const fsName = 'node:fs';
    const pathName = 'node:path';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsMod = require(fsName) as Pick<NodeFsPath, 'existsSync' | 'readFileSync'>;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pathMod = require(pathName) as Pick<NodeFsPath, 'resolve'>;
    return {
      existsSync: fsMod.existsSync,
      readFileSync: fsMod.readFileSync,
      resolve: pathMod.resolve,
    };
  } catch {
    return null;
  }
};

/* istanbul ignore next -- non-Node edge runtime guard */
const readCwd = (): string =>
  typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '.';

const normalizeSource = (raw: unknown): ConfigSetSource | undefined => {
  if (!isRecord(raw)) return undefined;
  const name = typeof raw['name'] === 'string' ? raw['name'] : undefined;
  const scope = typeof raw['scope'] === 'string' ? raw['scope'] : undefined;
  const rawVersion = raw['versionNumber'] ?? raw['version_number'];
  const versionNumber = typeof rawVersion === 'number' ? rawVersion : undefined;
  if (!name || !scope || versionNumber === undefined) return undefined;
  const rawId = raw['configSetId'] ?? raw['config_set_id'];
  return {
    ...(typeof rawId === 'string' ? { configSetId: rawId } : {}),
    name,
    versionNumber,
    scope,
  };
};

const normalizeEntry = (raw: unknown): ConfigSetEntry | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw['key'] !== 'string' || typeof raw['value'] !== 'string') return null;
  const rawType = raw['type'];
  const type =
    typeof rawType === 'string' && VALID_ITEM_TYPES.has(rawType as ConfigSetItemType)
      ? (rawType as ConfigSetItemType)
      : undefined;
  const source = normalizeSource(raw['source']);
  return {
    key: raw['key'],
    value: raw['value'],
    ...(type ? { type } : {}),
    secret: raw['secret'] === true || type === 'secret',
    ...(source ? { source } : {}),
  };
};

/** Normalize both SaaS `snake_case` and local `camelCase` snapshot payloads. */
export const normalizeConfigSetSnapshot = (raw: unknown): ConfigSetSnapshot | null => {
  if (!isRecord(raw) || !Array.isArray(raw['entries'])) return null;
  const rawVersion = raw['snapshotVersion'] ?? raw['snapshot_version'];
  const snapshotVersion = typeof rawVersion === 'number' ? rawVersion : 0;
  const entries: ConfigSetEntry[] = [];
  for (const item of raw['entries']) {
    const normalized = normalizeEntry(item);
    if (!normalized) return null;
    entries.push(normalized);
  }
  const stage = typeof raw['stage'] === 'string' ? raw['stage'] : undefined;
  return {
    ...(stage ? { stage } : {}),
    snapshotVersion,
    entries,
  };
};

const filterSnapshotEntries = (
  snapshot: ConfigSetSnapshot,
  include?: readonly string[],
): ConfigSetSnapshot => {
  if (!include || include.length === 0) return snapshot;
  const wanted = new Set(include);
  return {
    ...snapshot,
    entries: snapshot.entries.filter((entry) => wanted.has(entry.key)),
  };
};

const cloneSnapshot = (snapshot: ConfigSetSnapshot): ConfigSetSnapshot => ({
  ...(snapshot.stage !== undefined ? { stage: snapshot.stage } : {}),
  snapshotVersion: snapshot.snapshotVersion,
  entries: snapshot.entries.map((entry) => ({
    ...entry,
    ...(entry.source ? { source: { ...entry.source } } : {}),
  })),
});

/** Pure value decoder: honors explicit `entry.type` when provided; otherwise
 * applies round-trip-safe scalar inference (never corrupting leading-zero
 * strings, trailing-zero decimals, unsafe integers, or secrets). */
export const parseConfigSetValue = (entry: ConfigSetEntry): ConfigSetValue => {
  const { value, type, secret } = entry;
  if (type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (type === 'boolean') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }
  if (type === 'json') {
    try {
      return JSON.parse(value) as ConfigSetValue;
    } catch {
      return value;
    }
  }
  if (type !== undefined || secret) {
    return value;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && String(parsed) === value) return parsed;
  }
  return value;
};

/**
 * Create a functional runtime ConfigSet client (epic #53 P2).
 *
 * Call at module init so the non-blocking prefetch overlaps handler cold-start.
 * Never throws on construction: failed initial fetches surface on reads (or
 * fall back to `.serverlessinsight/local-config.json` in local mode).
 */
export const createConfigSet = (options?: ConfigSetOptions): ConfigSet => {
  const consoleUrl = options?.consoleUrl ?? readEnv('SI_CONSOLE_URL');
  const token = options?.token ?? readEnv('SI_CONFIG_TOKEN');
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryBackoffMs = options?.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
  const prefetch = options?.prefetch ?? true;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const disableLocalFile = options?.disableLocalFile ?? false;
  const localFilePath = options?.localFilePath;
  const include = options?.include ? [...options.include] : undefined;

  let state: CacheState = { snapshot: null, fetchedAt: 0, retryAfter: 0 };
  let inFlight: Promise<ConfigSetSnapshot> | null = null;

  const readLocalSnapshot = (): ConfigSetSnapshot | null => {
    if (disableLocalFile) return null;
    const node = loadNodeFsPath();
    /* istanbul ignore next -- non-Node edge runtime guard */
    if (!node) return null;
    try {
      const file = localFilePath ?? node.resolve(readCwd(), LOCAL_SNAPSHOT_PATH);
      if (!node.existsSync(file)) return null;
      const parsed: unknown = JSON.parse(node.readFileSync(file, 'utf-8'));
      const normalized = normalizeConfigSetSnapshot(parsed);
      return normalized ? filterSnapshotEntries(normalized, include) : null;
    } catch {
      return null;
    }
  };

  const fetchSnapshot = async (): Promise<ConfigSetSnapshot> => {
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    /* istanbul ignore next -- timer.unref is Node-only */
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
    try {
      const response = await fetchImpl(`${consoleUrl.replace(/\/+$/, '')}/api/v1/runtime/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(include ? { include } : {}),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`ConfigSet fetch failed: HTTP ${response.status}`);
      }
      const body = (await response.json()) as { code?: number; data?: unknown };
      const normalized = normalizeConfigSetSnapshot(body?.data);
      if (!normalized) {
        throw new Error('ConfigSet response missing valid snapshot data');
      }
      return normalized;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };

  const loadFresh = (): Promise<ConfigSetSnapshot> => {
    if (!inFlight) {
      inFlight = (async () => {
        try {
          if (!consoleUrl || !token) {
            const local = readLocalSnapshot();
            if (local) {
              state = { snapshot: local, fetchedAt: Date.now(), retryAfter: 0 };
              return local;
            }
            throw new Error(
              'ConfigSet is not configured — deploy with config refs to inject SI_CONFIG_TOKEN, or run `si local` for the local snapshot',
            );
          }
          const fresh = await fetchSnapshot();
          state = { snapshot: fresh, fetchedAt: Date.now(), retryAfter: 0 };
          return fresh;
        } catch (error) {
          if (state.snapshot) {
            state = { ...state, retryAfter: Date.now() + retryBackoffMs };
          }
          throw error;
        } finally {
          inFlight = null;
        }
      })();
    }
    return inFlight;
  };

  const ensureFresh = async (): Promise<ConfigSetSnapshot> => {
    const now = Date.now();
    if (state.snapshot && (now - state.fetchedAt < ttlMs || now < state.retryAfter)) {
      return state.snapshot;
    }
    try {
      return await loadFresh();
    } catch (error) {
      // Last-good fallback: serve the cached snapshot during transient outages;
      // surface the error only when no snapshot has ever been loaded.
      if (state.snapshot) return state.snapshot;
      throw error;
    }
  };

  const findEntry = (snapshot: ConfigSetSnapshot, key: string): ConfigSetEntry => {
    const entry = snapshot.entries.find((item) => item.key === key);
    if (!entry) {
      throw new Error(`ConfigSet key "${key}" not found in snapshot v${snapshot.snapshotVersion}`);
    }
    return entry;
  };

  if (prefetch && consoleUrl && token) {
    void ensureFresh().catch(() => {});
  }

  return {
    get: async (key) => {
      const snapshot = await ensureFresh();
      return parseConfigSetValue(findEntry(snapshot, key));
    },
    getSecret: async (key) => {
      const snapshot = await ensureFresh();
      return findEntry(snapshot, key).value;
    },
    snapshot: async () => cloneSnapshot(await ensureFresh()),
    refresh: async () => {
      await loadFresh();
    },
  };
};

export default createConfigSet;
