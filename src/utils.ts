import { Socket } from 'net';
import { TLSSocket } from 'tls';

export function isFloat(number: number): boolean {
  return Number.isFinite(number) && !Number.isInteger(number);
}

export function connectionWrite(
  connect: Socket | TLSSocket,
  buffer: Buffer | string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    connect.write(buffer, (writeError) => {
      if (writeError) {
        reject(writeError);
        return;
      }
      connect.once('data', (data) => {
        resolve(data);
      });
      connect.once('error', (err) => {
        reject(err);
      });
    });
  });
}
