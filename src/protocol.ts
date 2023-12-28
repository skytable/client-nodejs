import { Parameter, Query, isSQParam } from './query';
import { isFloat } from './utils';

export const PARAMS_TYPE = {
  NULL: new Uint8Array([0x00]),
  BOOLEAN: new Uint8Array([0x01]),
  UINT: new Uint8Array([0x02]),
  SINT: new Uint8Array([0x03]),
  FLOAT: new Uint8Array([0x04]),
  BINARY: new Uint8Array([0x05]),
  STRING: new Uint8Array([0x06]),
};

export const NEWLINE = new Uint8Array([0x0a]);
const STATICALLY_ENCODED_BOOL_FALSE = new Uint8Array([0x00]);
const STATICALLY_ENCODED_BOOL_TRUE = new Uint8Array([0x01]);

export function encodeParams(query: Query, param: Parameter): void {
  switch (typeof param) {
    case 'boolean': {
      query
        .getParamBuffer()
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
        .getParamBuffer()
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
        .getParamBuffer()
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
        .getParamBuffer()
        .push(Buffer.concat([PARAMS_TYPE.STRING, Buffer.from(param), NEWLINE]));
      break;
    }
    case 'object': {
      if (param === null) {
        query.getParamBuffer().push(PARAMS_TYPE.NULL);
        break;
      } else if (param instanceof Buffer) {
        query
          .getParamBuffer()
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
        return query.incrQueryCountBy(
          param.encodeUnsafe(query.getParamBuffer()),
        );
      }
    }
    default:
      throw new TypeError(`unsupported type: ${typeof param}, val: ${param}`);
  }
  query.incrQueryCountBy(1);
}
