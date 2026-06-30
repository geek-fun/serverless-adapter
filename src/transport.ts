import { Writable } from 'stream';
import { IncomingHttpHeaders } from 'http';
import ServerlessRequest from './serverlessRequest';
import ServerlessResponse from './serverlessResponse';

type MultiValueHeaders = {
  [key: string]: string[];
};
export const waitForStreamComplete = (stream: Writable): Promise<Writable> => {
  if (stream.writableFinished || stream.writableEnded) {
    return Promise.resolve(stream);
  }

  return new Promise((resolve, reject) => {
    let isComplete = false;

    function complete(err?: Error) {
      if (isComplete) {
        return;
      }

      isComplete = true;

      stream.removeListener('error', complete);
      stream.removeListener('end', complete);
      stream.removeListener('finish', complete);

      if (err) {
        reject(err);
      } else {
        resolve(stream);
      }
    }

    stream.once('error', complete);
    stream.once('end', complete);
    stream.once('finish', complete);
  });
};

const sanitizeHeaders = (headers: IncomingHttpHeaders) => {
  return Object.keys(headers).reduce(
    (memo, key) => {
      const value = headers[key];

      if (Array.isArray(value)) {
        memo.multiValueHeaders[key] = value;
        if (key.toLowerCase() !== 'set-cookie') {
          memo.headers[key] = value.join(', ');
        }
      } else {
        memo.headers[key] = value == null ? '' : value.toString();
      }

      return memo;
    },
    {
      headers: {} as IncomingHttpHeaders,
      multiValueHeaders: {} as MultiValueHeaders,
    },
  );
};

export const buildResponse = ({
  request,
  response,
}: {
  request: ServerlessRequest;
  response: ServerlessResponse;
}) => {
  const { headers, multiValueHeaders } = sanitizeHeaders(ServerlessResponse.headers(response));

  const contentType = String(headers['content-type'] || '');
  const isBinaryResponse = Boolean(
    contentType &&
    (contentType.startsWith('image/') ||
      contentType.startsWith('audio/') ||
      contentType.startsWith('video/') ||
      contentType === 'application/octet-stream' ||
      contentType === 'application/pdf' ||
      contentType.includes('font/')),
  );

  const bodyBuffer = ServerlessResponse.body(response);
  let body: string;

  if (isBinaryResponse) {
    body = bodyBuffer.toString('base64');
  } else if (headers['transfer-encoding'] === 'chunked' || response.chunkedEncoding) {
    const raw = bodyBuffer.toString().split('\r\n');
    const parsed: string[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const size = parseInt(raw[i], 16);
      const value = raw[i + 1];
      if (value) {
        parsed.push(value.substring(0, size));
      }
    }
    body = parsed.join('');
  } else {
    body = bodyBuffer.toString(request.isBase64Encoded ? 'base64' : 'utf8');
  }

  return {
    statusCode: response.statusCode,
    body,
    headers,
    multiValueHeaders,
    isBase64Encoded: isBinaryResponse || request.isBase64Encoded,
  };
};
