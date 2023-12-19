import { connect as connectTcp, Socket, NetConnectOpts } from 'node:net';
import {
  connect as connectTcpTLS,
  TLSSocket,
  ConnectionOptions as ConnectionTLSOptions,
} from 'node:tls';

export function createConnection(options: NetConnectOpts): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const conn = connectTcp(options);
    conn.once('connect', () => {
      resolve(conn);
    });

    conn.once('error', (error) => {
      console.error(`createConnection error: ${error.message}`);
      reject(error);
    });
  });
}

export function createConnectionTls(
  options: ConnectionTLSOptions,
): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const conn = connectTcpTLS(options);
    conn.once('connect', () => {
      resolve(conn);
    });

    conn.once('error', (error) => {
      console.error(`createConnection error: ${error.message}`);
      reject(error);
    });
  });
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
