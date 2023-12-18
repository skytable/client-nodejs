
export type ConnectionOptions = {
  port: number;
  hostname: string;
}

export type ConnectionTlsOptions = ConnectionOptions & { certFile: string }

export type SQParam = string | number | boolean | null | bigint;
