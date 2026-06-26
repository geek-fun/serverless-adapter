import ServerlessResponse from './serverlessResponse';
import ServerlessRequest from './serverlessRequest';

// eslint-disable-next-line
const callableFn = (callback: (req: any, res: any) => Promise<void>) => {
  return async (request: ServerlessRequest) => {
    const response = new ServerlessResponse(request);

    callback(request, response);

    return response;
  };
};

const honoHandler = (app: { fetch: (req: Request) => Response | Promise<Response> }) => {
  return async (request: ServerlessRequest): Promise<ServerlessResponse> => {
    const url = new URL(request.url || '/', 'http://localhost');
    const method = (request.method || 'GET').toUpperCase();

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, String(v));
      } else {
        headers.set(key, String(value));
      }
    }

    const hasBody = method !== 'GET' && method !== 'HEAD' && request.body !== undefined;
    const webRequest = new Request(url, {
      method,
      headers,
      body: hasBody ? (request.body as BodyInit) : undefined,
    });

    const webResponse = await app.fetch(webRequest);

    const response = new ServerlessResponse(request);
    response.statusCode = webResponse.status;

    // Collect set-cookie values across Node 18 (no getSetCookie) and Node 20+
    const hasGetSetCookie = typeof (webResponse.headers as Headers).getSetCookie === 'function';
    const setCookieValues: string[] = [];
    if (hasGetSetCookie) {
      const cookies = (webResponse.headers as Headers).getSetCookie();
      if (cookies) setCookieValues.push(...cookies);
    }

    webResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        // Node 18 fallback: getSetCookie not available, collect from forEach
        if (!hasGetSetCookie) setCookieValues.push(value);
        return;
      }
      response.setHeader(key, value);
    });

    // Single-value → string (included in headers); multi-value → array (in multiValueHeaders only)
    if (setCookieValues.length === 1) {
      response.setHeader('set-cookie', setCookieValues[0]);
    } else if (setCookieValues.length > 1) {
      response.setHeader('set-cookie', setCookieValues);
    }

    const bodyBuffer = Buffer.from(await webResponse.arrayBuffer());
    response.end(bodyBuffer);

    return response;
  };
};

// eslint-disable-next-line
export const constructFramework = (app: any) => {
  if (typeof app.fetch === 'function') {
    // Hono (Web API standard)
    return honoHandler(app);
  } else if (typeof app.callback === 'function') {
    // Koa
    return callableFn(app.callback());
  } else if (typeof app === 'function') {
    // Express
    return callableFn(app);
  } else {
    throw new Error(`Unsupported framework ${app}`);
  }
};
