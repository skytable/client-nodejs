import {createConnection} from "./connection"
import {createSkytable} from "./skytable"

export function getClientHandshake(config: Config) {
  const username = config.getUsername()
  const password = config.getPassword()

  return [
    'H\x00\x00\x00\x00\x00',
    username.length,
    '\n',
    password.length,
    '\n',
    username,
    password
  ].join('')
}

export function readBufferToHandshakeRes(buffer: Buffer) {
  const [h, c1, c2, msg] = Array.from(buffer.toJSON().data)

  return {
    code: [String.fromCharCode(h), c1, c2].join(''),
    msg
  }
}

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
    const connect = await createConnection({port: this.port, host: this.host})

    return new Promise((resolve, reject) => {
      connect.write(getClientHandshake(this), (writeError) => {
        if (writeError) {
          console.error(`Error Write: ${writeError.message}`)
          return
        }

        connect.once('data', (data) => {
          const { code, msg } = readBufferToHandshakeRes(data);
          console.log('get data: ', code + msg)
          switch (code) {
            case 'H00': // Success
              console.log('Success handshake')
              resolve(createSkytable(connect));
              return
            case 'H01': // Error
              // TODO HandshakeError: handshake error code {msg}
              resolve(new Error(`handshake error code ${msg}`));
              return
          }

        })
      })
    })
  }

  connectTSL(cert: string) {

  }
}
