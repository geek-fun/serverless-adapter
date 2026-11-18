import fs from 'node:fs';
import path from 'node:path';
import { siConfig, type SiRuntime } from '../src/config';

type MockResponse = { ok: boolean; status?: number; json: () => Promise<unknown> };

const jsonResponse = (body: unknown, ok = true, status = 200): MockResponse => ({
  ok,
  status,
  json: async () => body,
});

const snapshotBody = (entries: Array<[string, string, boolean?]>, version = 7) => ({
  code: 2000,
  data: {
    stage: 'prod',
    snapshotVersion: version,
    entries: entries.map(([key, value, secret]) => ({ key, value, secret: secret ?? false })),
  },
});

const sampleEntries: Array<[string, string, boolean?]> = [
  ['db.host', 'db.prod.internal'],
  ['db.port', '5432'],
  ['db.password', 'sup3r-s3cret', true],
  ['feature.flag', 'true'],
];

describe('siConfig runtime SDK (epic #53 P2)', () => {
  afterEach(() => {
    delete process.env['SI_CONFIG_TOKEN'];
    delete process.env['SI_CONSOLE_URL'];
    jest.restoreAllMocks();
  });

  const makeRuntime = (
    fetchMock: jest.Mock,
    options?: Partial<Parameters<typeof siConfig.init>[0]>,
  ): SiRuntime =>
    siConfig.init({
      consoleUrl: 'https://console.example.test/',
      token: 'sirt_com_test_secret',
      fetchImpl: fetchMock as unknown as typeof fetch,
      ...options,
    });

  it('init prefetches, strips trailing slashes and serves typed values', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(snapshotBody(sampleEntries)));
    const si = makeRuntime(fetchMock);
    // prefetch resolves without throwing even before any read
    await si.refresh();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://console.example.test/api/v1/runtime/config',
      expect.objectContaining({ method: 'POST' }),
    );
    await expect(si.get('db.host')).resolves.toBe('db.prod.internal');
    await expect(si.get('db.port')).resolves.toBe(5432);
    await expect(si.get('feature.flag')).resolves.toBe(true);
    await expect(si.getSecret('db.password')).resolves.toBe('sup3r-s3cret');
  });

  it('caches within the TTL — repeated reads do not refetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(snapshotBody(sampleEntries)));
    const si = makeRuntime(fetchMock, { ttlMs: 60_000 });
    await si.get('db.host');
    await si.get('db.host');
    await si.get('db.port');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('include option forwards the filter to the snapshot endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(snapshotBody(sampleEntries)));
    const si = makeRuntime(fetchMock, { include: ['db.host'] });
    await si.refresh();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ include: ['db.host'] }) }),
    );
  });

  it('refetches after the TTL expires', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(snapshotBody(sampleEntries)));
    const si = makeRuntime(fetchMock, { ttlMs: 5 });
    await si.get('db.host');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await si.get('db.port');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves the last-good snapshot when a refresh fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(snapshotBody(sampleEntries, 7)))
      .mockRejectedValueOnce(new Error('network down'));
    const si = makeRuntime(fetchMock, { ttlMs: 5 });
    await expect(si.get('db.host')).resolves.toBe('db.prod.internal');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(si.get('db.host')).resolves.toBe('db.prod.internal');
  });

  it('throws on reads when the first fetch fails and no snapshot exists', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    const si = makeRuntime(fetchMock);
    await expect(si.get('db.host')).rejects.toThrow('network down');
  });

  it('surfaces HTTP failures', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, false, 401));
    const si = makeRuntime(fetchMock);
    await expect(si.get('db.host')).rejects.toThrow('HTTP 401');
  });

  it('rejects malformed snapshot payloads', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ code: 2000 }));
    const si = makeRuntime(fetchMock);
    await expect(si.get('db.host')).rejects.toThrow('missing data');
  });

  it('unknown keys fail loudly with the snapshot version', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(snapshotBody(sampleEntries)));
    const si = makeRuntime(fetchMock);
    await expect(si.get('nope.key')).rejects.toThrow('not found in snapshot v7');
    await expect(si.getSecret('nope.key')).rejects.toThrow('not found in snapshot v7');
  });

  // The local snapshot file is read through the REAL node:fs — the tests write
  // a genuine file into the repo's cwd instead of mocking a core module.
  const LOCAL_FILE = path.resolve(process.cwd(), '.serverlessinsight', 'local-config.json');

  const writeLocalFile = (content: string | null): (() => void) => {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    if (content === null) {
      fs.rmSync(LOCAL_FILE, { force: true });
      return () => fs.rmSync(LOCAL_FILE, { force: true });
    }
    fs.writeFileSync(LOCAL_FILE, content);
    return () => fs.rmSync(LOCAL_FILE, { force: true });
  };

  it('falls back to the si local snapshot file when no token is configured', async () => {
    const fetchMock = jest.fn();
    const cleanup = writeLocalFile(
      JSON.stringify({
        stage: 'prod',
        snapshotVersion: 3,
        entries: [{ key: 'db.host', value: 'localhost', secret: false }],
      }),
    );
    try {
      const si = siConfig.init({ fetchImpl: fetchMock as unknown as typeof fetch });
      await expect(si.get('db.host')).resolves.toBe('localhost');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('reports a clear error when neither token nor local snapshot exists', async () => {
    const fetchMock = jest.fn();
    const cleanup = writeLocalFile(null);
    try {
      const si = siConfig.init({ fetchImpl: fetchMock as unknown as typeof fetch });
      await expect(si.get('db.host')).rejects.toThrow(/not configured/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('ignores unreadable local snapshot files (corrupt JSON)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('should not fetch'));
    const cleanup = writeLocalFile('not-json{');
    try {
      const si = siConfig.init({ fetchImpl: fetchMock as unknown as typeof fetch });
      await expect(si.get('db.host')).rejects.toThrow(/not configured|should not fetch/);
    } finally {
      cleanup();
    }
  });

  it('env vars feed the default configuration', async () => {
    process.env['SI_CONSOLE_URL'] = 'https://env-console.example.test';
    process.env['SI_CONFIG_TOKEN'] = 'sirt_com_abc_secret';
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(snapshotBody(sampleEntries)));
    const si = siConfig.init({ fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(si.get('db.host')).resolves.toBe('db.prod.internal');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://env-console.example.test/api/v1/runtime/config',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sirt_com_abc_secret' }),
      }),
    );
  });

  it('snapshot() exposes the consistent view with its version', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(snapshotBody(sampleEntries, 9)));
    const si = makeRuntime(fetchMock);
    const snapshot = await si.snapshot();
    expect(snapshot.snapshotVersion).toBe(9);
    expect(snapshot.entries).toHaveLength(4);
    expect(snapshot.stage).toBe('prod');
  });
});
