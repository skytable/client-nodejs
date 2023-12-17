
export type ConnectionOptions = {
  port: number;
  hostname: string;
}

export type ConnectionTlsOptions = ConnectionOptions & { certFile: string }
