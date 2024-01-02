import { Config } from './config';
import { Parameter, Query, isSQParam } from './query';
import { isFloat } from './utils';

/*
  Handshake
*/

const HANDSHAKE_RESULT = {
  SUCCESS: 'H00',
  ERROR: 'H01',
};

export function handshakeEncode(config: Config): string {
  const username = config.getUsername();
  const password = config.getPassword();
  return [
    'H\x00\x00\x00\x00\x00',
    username.length,
    '\n',
    password.length,
    '\n',
    username,
    password,
  ].join('');
}

export function handshakeDecode(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const [h, c1, c2, msg] = Array.from(buffer.toJSON().data);
    const code = [String.fromCharCode(h), c1, c2].join('');
    if (code === HANDSHAKE_RESULT.SUCCESS) {
      return resolve();
    }
    reject(new Error(`handshake error code ${code}, msg: ${msg}`));
  });
}

/*
  Query implementations
*/

export const NEWLINE = new Uint8Array([0x0a]);
const STATICALLY_ENCODED_BOOL_FALSE = new Uint8Array([0x00]);
const STATICALLY_ENCODED_BOOL_TRUE = new Uint8Array([0x01]);

export const PARAMS_TYPE = {
  NULL: new Uint8Array([0x00]),
  BOOLEAN: new Uint8Array([0x01]),
  UINT: new Uint8Array([0x02]),
  SINT: new Uint8Array([0x03]),
  FLOAT: new Uint8Array([0x04]),
  BINARY: new Uint8Array([0x05]),
  STRING: new Uint8Array([0x06]),
};

export function queryEncodeParams(query: Query, param: Parameter): void {
  switch (typeof param) {
    case 'boolean': {
      query
        ._getParamBuffer()
        .push(
          Buffer.concat([
            PARAMS_TYPE.BOOLEAN,
            param
              ? STATICALLY_ENCODED_BOOL_TRUE
              : STATICALLY_ENCODED_BOOL_FALSE,
          ]),
        );
      break;
    }
    case 'number': {
      query
        ._getParamBuffer()
        .push(
          Buffer.concat([
            isFloat(param)
              ? PARAMS_TYPE.FLOAT
              : param < 0
                ? PARAMS_TYPE.SINT
                : PARAMS_TYPE.UINT,
            Buffer.from(param.toString()),
            NEWLINE,
          ]),
        );
      break;
    }
    case 'bigint': {
      query
        ._getParamBuffer()
        .push(
          Buffer.concat([
            param < 0 ? PARAMS_TYPE.SINT : PARAMS_TYPE.UINT,
            Buffer.from(param.toString()),
            NEWLINE,
          ]),
        );
      break;
    }
    case 'string': {
      query
        ._getParamBuffer()
        .push(Buffer.concat([PARAMS_TYPE.STRING, Buffer.from(String(param.length)), NEWLINE, Buffer.from(String(param))]));
      break;
    }
    case 'object': {
      if (param === null) {
        query._getParamBuffer().push(PARAMS_TYPE.NULL);
        break;
      } else if (param instanceof Buffer) {
        query
          ._getParamBuffer()
          .push(
            Buffer.concat([
              PARAMS_TYPE.BINARY,
              Buffer.from(param.length.toString()),
              NEWLINE,
              param,
            ]),
          );
        break;
      } else if (isSQParam(param)) {
        return query._incrQueryCountBy(
          param.encodeUnsafe(query._getParamBuffer()),
        );
      }
    }
    default:
      throw new TypeError(`unsupported type: ${typeof param}, val: ${param}`);
  }
  query._incrQueryCountBy(1);
}

/*
  response implementations
*/

export type SimpleValue = null | boolean | number | bigint | Buffer | string;
export type Value = SimpleValue | Value[];
export type Row = Value[];
export type Rows = Row[];
export type Response = Value | Row | Rows | Empty;

/**
 * An empty response, usually indicative of a succesful action (much like HTTP 200)
 */
export class Empty {
  constructor() {}
}
