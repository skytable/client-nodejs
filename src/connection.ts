/**
 * WARNING
 * ---
 * This is an incomplete implementation for the buffer read from the socket.
 *
 * It needs to be fixed so that if sufficient data is not buffered, we should enter a retry
 * read loop (as is obvious).
 *
 * TODO(@ohsayan)
 */

import { Socket, connect as connectTcp } from 'net';
import {
  TLSSocket,
  connect as connectTcpTLS,
  ConnectionOptions as TlsOptions,
} from 'tls';
import { Query } from './query';
import {
  NEWLINE,
  Response,
  handshakeEncode,
  handshakeDecode,
} from './protocol';
import { Config } from './config';
import { connectionWrite } from './utils';
import { Decode } from './decode';

export function createTcp(c: Config): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const conn = connectTcp({
      port: c.getPort(),
      host: c.getHost(),
    });
    conn.once('connect', () => {
      resolve(new Connection(conn));
    });
    conn.once('error', (error) => {
      console.error(`tcp connection failed with error: ${error.message}`);
      reject(error);
    });
  });
}
export function createTls(c: Config, tlsOpts: TlsOptions): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const conn = connectTcpTLS(tlsOpts);
    conn.once('connect', () => {
      resolve(new Connection(conn));
    });
    conn.once('error', (error) => {
      console.error(`tls connection failed with error: ${error.message}`);
      reject(error);
    });
  });
}

export class Connection {
  private socket: TLSSocket | Socket;
  constructor(c: TLSSocket | Socket) {
    this.socket = c;
  }
  async _handshake(c: Config): Promise<void> {
    const data = await connectionWrite(this.socket, handshakeEncode(c));
    await handshakeDecode(data);
  }
  public query(q: Query): Promise<Response> {
    return new Promise((resolve, reject) => {
      const decode = new Decode();
      // Set listeners
      const dataListener = (buf: Buffer) => {
        try {
          decode.append(buf);
          if (decode.isComplete) {
            resolve(decode.getValue());
          }
        } catch(e) {
          reject(e);
        } finally {
          resetListener();
        }
        
      };
      const errorListener = (e: Error) => {
        resetListener();
        reject(e);
      };
      const resetListener = () => {
        this.socket.off('error', errorListener);
        this.socket.off('data', dataListener);
      }
      this.socket.on('data', dataListener);
      this.socket.once('error', errorListener);
      // Calculate dataframe size
      const queryBuffer = q.getQuery();
      const paramsBuffer = q._getParamBuffer();
      const qWindow = queryBuffer.length.toString();
      // Calculate packet size
      const packetSize =
        qWindow.length +
        1 +
        queryBuffer.length +
        paramsBuffer.reduce((acc, buf) => acc + buf.length, 0);
      // send data
      this.socket.write('S');
      this.socket.write(packetSize.toString());
      this.socket.write(NEWLINE);
      this.socket.write(qWindow);
      this.socket.write(NEWLINE);
      this.socket.write(queryBuffer);
      paramsBuffer.forEach((buf) => this.socket.write(buf));
    });
  }
  public async disconnect() {
    if (this.socket) {
      this.socket.destroySoon();
    }
  }
}
