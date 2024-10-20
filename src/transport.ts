import { Writable } from 'stream';
import ServerlessRequest from './serverlessRequest';
import ServerlessResponse from './serverlessResponse';

export const waitForStreamComplete = (stream: Writable): Promise<Writable> => {
  if (stream.writableFinished || stream.writableEnded) {
    return Promise.resolve(stream);
  }

  return new Promise((resolve, reject) => {
    stream.once('error', complete);
    stream.once('end', complete);
    stream.once('finish', complete);

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
  });
};

export const buildResponse = ({
  request,
  response,
}: {
  request: ServerlessRequest;
  response: ServerlessResponse;
}) => {
  return {
    statusCode: response.statusCode,
    body: ServerlessResponse.body(response).toString(request.isBase64Encoded ? 'base64' : 'utf8'),
    headers: response.headers,
    isBase64Encoded: request.isBase64Encoded,
  };
};
