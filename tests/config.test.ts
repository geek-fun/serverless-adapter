import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import createConfigSet, {
  normalizeConfigSetSnapshot,
  parseConfigSetValue,
  type ConfigSet,
  type ConfigSetItemType,
  type ConfigSetOptions,
} from '../src/config';

type MockResponse = { ok: boolean; status?: number; json: () => Promise<unknown> };

const jsonResponse = (body: unknown, ok = true, status = 200): MockResponse => ({
  ok,
  status,
  json: async () => body,
});

type EntryTuple = [string, string, boolean?, ConfigSetItemType?];

/** Mirrors real SaaS `toSnakeCase` wire format (`snapshot_version`, `source.version_number`). */
const saasSnapshotBody = (entries: EntryTuple[], version = 7) => ({
  code: 2000,
  messages: ['success'],
  data: {
    snapshot_version: version,
    entries: entries.map(([key, value, secret, type]) => ({
      key,
      value,
      ...(type ? { type } : {}),
      secret: secret ?? false,
      source: {
        config_set_id: 'cs-1',
        name: key.split('.')[0],
        version_number: 3,
        scope: 'stage',
      },
    })),
  },
});

const sampleEntries: EntryTuple[] = [
  ['db.host', 'db.prod.internal', false, 'string'],
  ['db.port', '5432', false, 'number'],
  ['db.password', 'sup3r-s3cret', true, 'secret'],
  ['feature.flag', 'true', false, 'boolean'],
  ['feature.off', 'false', false, 'boolean'],
  ['app.zip', '02138', false, 'string'],
  ['app.version', '1.10', false, 'string'],
  ['app.meta', '{"tier":"pro","retries":3}', false, 'json'],
];

describe('createConfigSet runtime SDK (epic #53 P2)', () => {
  afterEach(() => {
    delete process.env['SI_CONFIG_TOKEN'];
    delete process.env['SI_CONSOLE_URL'];
    jest.restoreAllMocks();
  });

  const makeConfigSet = (fetchMock: jest.Mock, options?: Partial<ConfigSetOptions>): ConfigSet =>
    createConfigSet({
      consoleUrl: 'https://console.example.test///',
      token: 'sirt_com_test_secret',
      fetchImpl: fetchMock as unknown as typeof fetch,
      ...options,
    });

  it('starts a non-blocking prefetch on creation and normalizes SaaS snake_case payloads', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(saasSnapshotBody(sampleEntries, 11)));
    const config = makeConfigSet(fetchMock);

    // Prefetch begins immediately during module init — before any read call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://console.example.test/api/v1/runtime/config',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer sirt_com_test_secret',
        }),
      }),
    );

    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    await expect(config.get('db.port')).resolves.toBe(5432);
    await expect(config.get('feature.flag')).resolves.toBe(true);
    await expect(config.get('feature.off')).resolves.toBe(false);
    await expect(config.get('app.zip')).resolves.toBe('02138');
    await expect(config.get('app.version')).resolves.toBe('1.10');
    await expect(config.get('app.meta')).resolves.toEqual({ tier: 'pro', retries: 3 });
    await expect(config.getSecret('db.password')).resolves.toBe('sup3r-s3cret');
    await expect(config.get('db.password')).resolves.toBe('sup3r-s3cret');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const snap = await config.snapshot();
    expect(snap.snapshotVersion).toBe(11);
    expect(snap.entries[0]?.source).toEqual({
      configSetId: 'cs-1',
      name: 'db',
      versionNumber: 3,
      scope: 'stage',
    });
  });

  it('deduplicates concurrent in-flight reads into a single network call', async () => {
    let resolveFetch!: (value: MockResponse) => void;
    const fetchMock = jest.fn(
      () =>
        new Promise<MockResponse>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const config = makeConfigSet(fetchMock, { prefetch: false });

    const reads = Promise.all([
      config.get('db.host'),
      config.get('db.port'),
      config.getSecret('db.password'),
      config.snapshot(),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(jsonResponse(saasSnapshotBody(sampleEntries)));

    const [host, port, secret, snap] = await reads;
    expect(host).toBe('db.prod.internal');
    expect(port).toBe(5432);
    expect(secret).toBe('sup3r-s3cret');
    expect(snap.snapshotVersion).toBe(7);
  });

  it('caches within TTL and refetches once TTL expires', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(saasSnapshotBody(sampleEntries)));
    const config = makeConfigSet(fetchMock, { ttlMs: 10, prefetch: false });
    await config.get('db.host');
    await config.get('db.port');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 25));
    await config.get('db.port');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forwards include filter in POST body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(saasSnapshotBody(sampleEntries)));
    const config = makeConfigSet(fetchMock, { include: ['db.host'], prefetch: false });
    await config.refresh();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ include: ['db.host'] }) }),
    );
  });

  it('serves last-good snapshot with backoff when TTL refresh fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(saasSnapshotBody(sampleEntries, 7)))
      .mockRejectedValueOnce(new Error('network down'));
    const config = makeConfigSet(fetchMock, {
      ttlMs: 10,
      retryBackoffMs: 5_000,
      prefetch: false,
    });
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Expired TTL triggers one refresh attempt; failure serves stale snapshot and backs off.
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserves last-good snapshot even when an explicit refresh() fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(saasSnapshotBody(sampleEntries, 7)))
      .mockRejectedValueOnce(new Error('saas outage'));
    const config = makeConfigSet(fetchMock, { prefetch: false, retryBackoffMs: 5_000 });
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');

    // Explicit refresh surfaces the error to the caller...
    await expect(config.refresh()).rejects.toThrow('saas outage');
    // ...but never destroys the cached last-good snapshot for subsequent reads.
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    expect((await config.snapshot()).snapshotVersion).toBe(7);
  });

  it('aborts hung fetches when timeoutMs elapses and falls back to last-good cache', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(saasSnapshotBody(sampleEntries, 7)))
      .mockImplementationOnce(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
    const config = makeConfigSet(fetchMock, {
      ttlMs: 10,
      timeoutMs: 15,
      retryBackoffMs: 5_000,
      prefetch: false,
    });
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    await new Promise((resolve) => setTimeout(resolve, 25));
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Disable timeout (timeoutMs: 0) executes cleanly without setting an abort timer.
    const noTimeoutFetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(saasSnapshotBody(sampleEntries)));
    const noTimeoutConfig = makeConfigSet(noTimeoutFetch, { timeoutMs: 0, prefetch: false });
    await expect(noTimeoutConfig.get('db.host')).resolves.toBe('db.prod.internal');
  });

  it('surfaces errors when initial fetch fails and no cached snapshot exists', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    const config = makeConfigSet(fetchMock);
    await expect(config.get('db.host')).rejects.toThrow('network down');
  });

  it('surfaces HTTP failures and rejects malformed payloads', async () => {
    const unauthorized = jest.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(makeConfigSet(unauthorized, { prefetch: false }).get('db.host')).rejects.toThrow(
      'HTTP 401',
    );

    const missingData = jest.fn().mockResolvedValue(jsonResponse({ code: 2000 }));
    await expect(makeConfigSet(missingData, { prefetch: false }).get('db.host')).rejects.toThrow(
      'missing valid snapshot data',
    );

    const missingEntries = jest.fn().mockResolvedValue(jsonResponse({ code: 2000, data: {} }));
    await expect(makeConfigSet(missingEntries, { prefetch: false }).get('db.host')).rejects.toThrow(
      'missing valid snapshot data',
    );
  });

  it('fails loudly with snapshot version when a key is missing', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(saasSnapshotBody(sampleEntries, 9)));
    const config = makeConfigSet(fetchMock, { prefetch: false });
    await expect(config.get('nope.key')).rejects.toThrow('not found in snapshot v9');
    await expect(config.getSecret('nope.key')).rejects.toThrow('not found in snapshot v9');
  });

  it('returns an immutable snapshot clone so caller mutations cannot corrupt the cache', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(saasSnapshotBody(sampleEntries, 9)));
    const config = makeConfigSet(fetchMock, { prefetch: false });
    const snap = await config.snapshot();
    (snap.entries as unknown[]).push({ key: 'injected', value: 'x', secret: false });
    (snap.entries[0] as { value: string }).value = 'mutated';

    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    expect((await config.snapshot()).entries).toHaveLength(sampleEntries.length);
  });

  describe('local snapshot fallback (si local)', () => {
    let tmpDir: string;
    let localFile: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'si-adapter-config-'));
      localFile = path.join(tmpDir, '.serverlessinsight', 'local-config.json');
      fs.mkdirSync(path.dirname(localFile), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('reads camelCase local-config.json and applies include filtering when token is absent', async () => {
      fs.writeFileSync(
        localFile,
        JSON.stringify({
          stage: 'prod',
          snapshotVersion: 4,
          entries: [
            {
              key: 'db.host',
              value: 'localhost',
              secret: false,
              source: { name: 'db', versionNumber: 4, scope: 'stage' },
            },
            { key: 'db.port', value: '5432', secret: false },
            { key: 'db.pin', value: '001234', secret: true },
          ],
        }),
      );
      const fetchMock = jest.fn();
      const config = createConfigSet({
        localFilePath: localFile,
        include: ['db.host', 'db.port', 'db.pin'],
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      await expect(config.get('db.host')).resolves.toBe('localhost');
      await expect(config.get('db.port')).resolves.toBe(5432);
      await expect(config.getSecret('db.pin')).resolves.toBe('001234');
      expect((await config.snapshot()).stage).toBe('prod');
      expect(fetchMock).not.toHaveBeenCalled();

      // Local mode without `include` returns the full snapshot.
      const unfiltered = createConfigSet({
        localFilePath: localFile,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect((await unfiltered.snapshot()).entries).toHaveLength(3);

      // Include filter excludes non-matching entries in local mode too.
      const filtered = createConfigSet({
        localFilePath: localFile,
        include: ['db.host'],
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      await expect(filtered.get('db.host')).resolves.toBe('localhost');
      await expect(filtered.get('db.port')).rejects.toThrow('not found in snapshot v4');
    });

    it('resolves default local-config.json relative to process.cwd() and rejects missing/corrupt files', async () => {
      jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
      const fetchMock = jest.fn();

      // Missing file
      const missing = createConfigSet({ fetchImpl: fetchMock as unknown as typeof fetch });
      await expect(missing.get('db.host')).rejects.toThrow(/not configured/);

      // Corrupt JSON
      fs.writeFileSync(localFile, 'not-json{');
      const corrupt = createConfigSet({ fetchImpl: fetchMock as unknown as typeof fetch });
      await expect(corrupt.get('db.host')).rejects.toThrow(/not configured/);

      // Valid JSON but missing entries array
      fs.writeFileSync(localFile, JSON.stringify({ snapshotVersion: 1 }));
      const malformed = createConfigSet({ fetchImpl: fetchMock as unknown as typeof fetch });
      await expect(malformed.get('db.host')).rejects.toThrow(/not configured/);

      // disableLocalFile ignores a valid file
      fs.writeFileSync(
        localFile,
        JSON.stringify({
          snapshotVersion: 1,
          entries: [{ key: 'db.host', value: 'x', secret: false }],
        }),
      );
      const disabled = createConfigSet({
        disableLocalFile: true,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      await expect(disabled.get('db.host')).rejects.toThrow(/not configured/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('reads SI_CONSOLE_URL / SI_CONFIG_TOKEN env defaults and global fetch when options are omitted', async () => {
    process.env['SI_CONSOLE_URL'] = 'https://env-console.example.test';
    process.env['SI_CONFIG_TOKEN'] = 'sirt_com_abc_secret';
    const globalFetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(saasSnapshotBody(sampleEntries)) as unknown as Response);

    const config = createConfigSet();
    await expect(config.get('db.host')).resolves.toBe('db.prod.internal');
    expect(globalFetchSpy).toHaveBeenCalledWith(
      'https://env-console.example.test/api/v1/runtime/config',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sirt_com_abc_secret' }),
      }),
    );
  });

  describe('pure helpers: normalizeConfigSetSnapshot & parseConfigSetValue', () => {
    it('rejects non-objects and malformed entries cleanly', () => {
      expect(normalizeConfigSetSnapshot(null)).toBeNull();
      expect(normalizeConfigSetSnapshot({ entries: [null] })).toBeNull();
      expect(normalizeConfigSetSnapshot({ entries: [{ key: 123, value: 'x' }] })).toBeNull();
      expect(
        normalizeConfigSetSnapshot({
          entries: [{ key: 'a.b', value: 'x', source: { name: 42 } }],
        }),
      ).toEqual({
        snapshotVersion: 0,
        entries: [{ key: 'a.b', value: 'x', secret: false }],
      });
    });

    it('handles explicit types and safe fallback inference without corrupting strings', () => {
      expect(
        parseConfigSetValue({ key: 'k', value: 'not-a-num', type: 'number', secret: false }),
      ).toBe('not-a-num');
      expect(
        parseConfigSetValue({ key: 'k', value: 'maybe', type: 'boolean', secret: false }),
      ).toBe('maybe');
      expect(parseConfigSetValue({ key: 'k', value: '{bad', type: 'json', secret: false })).toBe(
        '{bad',
      );
      // Untyped fallback preserves leading zeros, trailing-zero decimals, unsafe ints, and secrets.
      expect(parseConfigSetValue({ key: 'k', value: '007', secret: false })).toBe('007');
      expect(parseConfigSetValue({ key: 'k', value: '1.10', secret: false })).toBe('1.10');
      expect(parseConfigSetValue({ key: 'k', value: '9007199254740993', secret: false })).toBe(
        '9007199254740993',
      );
      expect(parseConfigSetValue({ key: 'k', value: 'true', secret: false })).toBe(true);
      expect(parseConfigSetValue({ key: 'k', value: 'false', secret: false })).toBe(false);
      expect(parseConfigSetValue({ key: 'k', value: '42', secret: true })).toBe('42');
    });
  });
});
