import {connectionWrite, createConnection} from "./connection"
import {createSkytable} from "./skytable"
import {bufferToHandshakeResult, getClientHandshake} from "./protocol"

/**
 * Configuration for a client connection (single node)
 */
export class Config {
  private username: string
  private password: string
  private host: string
  private port: number

  /**
   * Create a new configuration
   *
   * @param username Set the username for authenticating with Skytable
   * @param password Set the password for authenticating with Skytable
   * @param host Set the host to connect to Skytable (defaults to `127.0.0.1`)
   * @param port Set the port to connect to Skytable (defaults to 2003)
   */
  constructor(username: string, password: string, host: string = 'localhost', port: number = 2003) {
    this.username = username
    this.password = password
    this.host = host
    this.port = port
  }

  /**
   * Get the set username
   * @returns Username set in this configuration
   */
  getUsername(): string {
    return this.username
  }

  /**
   * Get the set password
   * @returns Username set in this configuration
   */
  getPassword(): string {
    return this.password
  }

  /**
   * Get the set host
   * @returns Username set in this configuration
   */
  getHost(): string {
    return this.host
  }

  /**
   * Get the set port
   * @returns Username set in this configuration
   */
  getPort(): number {
    return this.port
  }

  async connect() {
    try {
      const connect = await createConnection({port: this.port, host: this.host})

      const data = await connectionWrite(connect, getClientHandshake(this))

      await bufferToHandshakeResult(data)

      return createSkytable(connect)
    } catch (e) {
      console.error(e)
    }
  }

  connectTSL(cert: string) {
    // TODO connectTSL
  }
}
