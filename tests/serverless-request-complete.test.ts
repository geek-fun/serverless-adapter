import type { IncomingMessage } from 'http';
import { IncomingForm } from 'formidable';
import ServerlessRequest from '../src/serverlessRequest';

// A body replayed by the adapter is complete at construction: the whole
// message is delivered to class consumers as one already-existing value.
const multipart = Buffer.from(
  '--X-BOUNDARY\r\nContent-Disposition: form-data; name="file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n' +
    'A'.repeat(5000) +
    '\r\n--X-BOUNDARY--\r\n',
  'utf8',
);

const build = (): IncomingMessage =>
  new ServerlessRequest({
    method: 'PUT',
    url: '/upload',
    path: '/upload',
    headers: { 'content-type': 'multipart/form-data; boundary=X-BOUNDARY' },
    body: multipart,
    remoteAddress: '1.2.3.4',
    isBase64Encoded: false,
  });

describe('ServerlessRequest completeness', () => {
  it('marks the replayed request complete (frontend-style consumers must not see aborted)', () => {
    const req = build();
    expect(req.complete).toBe(true);
  });

  it('parses a multipart body without FormidableError 1002', async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      new IncomingForm({ multiples: true }).parse(build(), (err, _fields, files) => {
        expect(err).toBeNull();
        expect(Object.keys(files ?? {})).toEqual(['file']);
        resolve();
      });
    });
  });
});
