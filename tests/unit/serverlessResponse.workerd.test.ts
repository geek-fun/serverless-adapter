import { createWorkerdResponsePatch } from '../../src/serverlessResponse';
import ServerlessRequest from '../../src/serverlessRequest';

const WORKERD_USER_AGENT = 'Cloudflare-Workers';

type ServerlessResponseModule = typeof import('../../src/serverlessResponse');

const loadModule = async (): Promise<ServerlessResponseModule> =>
  import('../../src/serverlessResponse');

const stubNavigator = (userAgent: string): PropertyDescriptor | undefined => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent }, configurable: true });
  return original;
};

const restoreNavigator = (original: PropertyDescriptor | undefined): void => {
  if (original) {
    Object.defineProperty(globalThis, 'navigator', original);
  } else {
    delete (globalThis as { navigator?: unknown }).navigator;
  }
};

const buildRequest = (): ServerlessRequest =>
  new ServerlessRequest({
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: {},
    body: undefined,
    remoteAddress: '',
    isBase64Encoded: false,
  });

describe('ServerlessResponse on workerd', () => {
  let originalNavigator: PropertyDescriptor | undefined;
  const patch = createWorkerdResponsePatch();

  beforeEach(() => {
    originalNavigator = stubNavigator(WORKERD_USER_AGENT);
    patch.apply();
  });

  afterEach(() => {
    patch.restore();
    restoreNavigator(originalNavigator);
  });

  it('reports the workerd runtime from the navigator user agent', async () => {
    const { isWorkerdRuntime } = await loadModule();

    expect(isWorkerdRuntime()).toBe(true);
  });

  it('captures text and binary bodies written through the patched prototype', async () => {
    const { default: ServerlessResponse } = await loadModule();
    patch.apply();

    const response = new ServerlessResponse(buildRequest());
    const finished = new Promise<void>((resolve) => response.once('finish', resolve));

    response.setHeader('content-type', 'text/plain');
    response.write('hello ');
    response.end('world');
    await finished;

    expect(ServerlessResponse.body(response).toString()).toBe('hello world');
    expect(ServerlessResponse.headers(response)['content-type']).toBe('text/plain');
    expect(response.writableEnded).toBe(true);
    expect(response.statusCode).toBe(200);

    const binaryResponse = new ServerlessResponse(buildRequest());
    binaryResponse.setHeader('content-type', 'image/png');
    binaryResponse.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect(Buffer.from(ServerlessResponse.body(binaryResponse))).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it('merges writeHead headers and keeps them visible through the static helper', async () => {
    const { default: ServerlessResponse } = await loadModule();
    patch.apply();

    const response = new ServerlessResponse(buildRequest());
    response.writeHead(201, { 'x-a': '1' });
    response.setHeader('x-b', '2');
    response.end();

    expect(response.statusCode).toBe(201);
    expect(ServerlessResponse.headers(response)).toMatchObject({ 'x-a': '1', 'x-b': '2' });
  });

  it('emits finish and skips the body for body-less end calls', async () => {
    const { default: ServerlessResponse } = await loadModule();
    patch.apply();

    const response = new ServerlessResponse(buildRequest());
    const finished = new Promise<void>((resolve) => response.once('finish', resolve));
    response.end();
    await finished;

    expect(ServerlessResponse.body(response).length).toBe(0);
  });

  it('is idempotent — applying the patch twice still captures each chunk once', async () => {
    const { default: ServerlessResponse } = await loadModule();
    patch.apply();
    patch.apply();

    const response = new ServerlessResponse(buildRequest());
    response.end('once');

    expect(ServerlessResponse.body(response).toString()).toBe('once');
  });
});

describe('ServerlessResponse on Node.js runtimes', () => {
  let originalNavigator: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalNavigator = stubNavigator('node');
  });

  afterEach(() => {
    restoreNavigator(originalNavigator);
  });

  it('reports a non-workerd runtime', async () => {
    const { isWorkerdRuntime } = await loadModule();

    expect(isWorkerdRuntime()).toBe(false);
  });
});
