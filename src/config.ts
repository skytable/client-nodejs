import { ConnectionOptions } from 'tls';
import { Connection, createTcp, createTls } from './connection';

export class Config {
  private username: string;
  private password: string;
  private host: string;
  private port: number;
  constructor(
    username: string,
    password: string,
    host: string = '127.0.0.1',
    port: number = 2003,
  ) {
    this.username = username;
    this.password = password;
    this.host = host;
    this.port = port;
  }
  /**
   * Get the set username
   * @returns Username set in this configuration
   */
  getUsername(): string {
    return this.username;
  }

  /**
   * Get the set password
   * @returns password set in this configuration
   */
  getPassword(): string {
    return this.password;
  }

  /**
   * Get the set host
   * @returns host set in this configuration
   */
  getHost(): string {
    return this.host;
  }

  /**
   * Get the set port
   * @returns port set in this configuration
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get a TCP connection to the database
   *
   * @returns a Skyhash/TCP connection
   */
  async connect(): Promise<Connection> {
    const con = await createTcp(this);
    await con._handshake(this);
    return con;
  }

  /**
   * Get a TLS connection to the database
   *
   * @param tlsOpts TLS options
   * @returns a Skyhash/TLS connection
   */
  async connectTls(tlsOpts: ConnectionOptions): Promise<Connection> {
    const con = await createTls(this, tlsOpts);
    await con._handshake(this);
    return con;
  }
}
