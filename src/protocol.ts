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
        .push(Buffer.concat([PARAMS_TYPE.STRING, Buffer.from(param), NEWLINE]));
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

const RESPONSES_RESULT = {
  NULL: 0,
  BOOL: 1,
  U8INT: 2,
  U16INT: 3,
  U32INT: 4,
  U64INT: 5,
  S8INT: 6,
  S16INT: 7,
  S32INT: 8,
  S64INT: 9,
  FLOAT32: 10,
  FLOAT64: 11,
  BINARY: 12,
  STRING: 13,
  LIST: 14,
  ERROR: 0x10,
  ROW: 0x11,
  EMPTY: 0x12,
  MULTIROW: 0x13,
};

function getFirstSplitOffset(buffer: Buffer, split = '\n'): number {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === split.charCodeAt(0)) {
      return i;
    }
  }
  return -1;
}

function parseNumber<T = number>(
  formatFn: (string: string) => T,
  buffer: Buffer,
): [T, Buffer] {
  const offset = getFirstSplitOffset(buffer);
  const val = formatFn(buffer.subarray(0, offset).toString('utf-8'));
  return [val, buffer.subarray(offset + 1)];
}

function parseNextBySize(size: number, buffer: Buffer): [Value[], Buffer] {
  let values = [];
  let nextBuffer = buffer;
  for (let i = 0; i < size; i++) {
    const [value, remainingBuffer] = decodeValue(nextBuffer);
    values.push(value);
    nextBuffer = remainingBuffer;
  }
  return [values, nextBuffer];
}

function decodeValue(buffer: Buffer): [Value, Buffer] {
  const type = buffer.readUInt8(0);
  buffer = buffer.subarray(1);
  switch (type) {
    case RESPONSES_RESULT.NULL: // Null
      return [null, buffer.subarray(0)];
    case RESPONSES_RESULT.BOOL: // Bool
      return [Boolean(buffer.readUInt8(0)), buffer.subarray(1)];
    case RESPONSES_RESULT.U8INT: // 8-bit Unsigned Integer
      return parseNumber(Number, buffer);
    case RESPONSES_RESULT.U16INT: // 16-bit Unsigned Integer
      return parseNumber(Number, buffer);
    case RESPONSES_RESULT.U32INT: // 32-bit Unsigned Integer
      return parseNumber(Number, buffer);
    case RESPONSES_RESULT.U64INT: // 64-bit Unsigned Integer
      return parseNumber<bigint>(BigInt, buffer);
    case RESPONSES_RESULT.S8INT: // 8-bit Signed Integer
      return parseNumber(Number, buffer);
    case RESPONSES_RESULT.S16INT: // 16-bit Signed Integer
      return parseNumber(Number, buffer);
    case RESPONSES_RESULT.S32INT: // 32-bit Signed Integer
      return parseNumber(Number, buffer);
    case RESPONSES_RESULT.S64INT: // 64-bit Signed Integer
      return parseNumber<bigint>(BigInt, buffer);
    case RESPONSES_RESULT.FLOAT32: // f32
      return parseNumber(Number.parseFloat, buffer);
    case RESPONSES_RESULT.FLOAT64: // f64
      return parseNumber(Number.parseFloat, buffer);
    case RESPONSES_RESULT.BINARY: {
      //  Binary <size>\n<payload>,
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      if (size === 0) {
        return [Buffer.from([]), buffer.subarray(sizeOffset + 1)];
      }
      const [start, end] = [sizeOffset + 1, sizeOffset + 1 + Number(size)];
      return [buffer.subarray(start, end), buffer.subarray(end)];
    }
    case RESPONSES_RESULT.STRING: {
      // String <size>\n<body>
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      const [start, end] = [sizeOffset + 1, sizeOffset + 1 + Number(size)];
      const str = buffer.subarray(start, end).toString('utf-8');
      return [str, buffer.subarray(end)];
    }
    case RESPONSES_RESULT.LIST: {
      // List <size>\n<body>
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      if (size === 0) {
        return [[], buffer.subarray(sizeOffset + 1)];
      }
      return parseNextBySize(size, buffer.subarray(sizeOffset + 1)) as [
        Value,
        Buffer,
      ];
    }
    default:
      throw new Error(`Unknown data type: ${type}`);
  }
}

function decodeRow(buffer: Buffer): Row {
  const offset = getFirstSplitOffset(buffer);
  const columnCount = Number(buffer.subarray(0, offset).toString('utf-8'));
  const dataType = buffer.subarray(offset + 1);
  const [row] = parseNextBySize(columnCount, dataType);
  return row;
}

function decodeRows(buffer: Buffer): Rows {
  const offset = getFirstSplitOffset(buffer);
  const rowCount = Number(buffer.subarray(0, offset).toString('utf-8'));
  buffer = buffer.subarray(offset + 1);
  const columnOffset = getFirstSplitOffset(buffer);
  const columnCount = Number(
    buffer.subarray(0, columnOffset).toString('utf-8'),
  );
  buffer = buffer.subarray(columnOffset + 1);
  const result: Rows = [];
  let nextBuffer = buffer;
  for (let i = 0; i < rowCount; i++) {
    const [row, remainingBuffer] = parseNextBySize(columnCount, nextBuffer);
    result[i] = row;
    nextBuffer = remainingBuffer;
  }
  return result;
}

export function responseDecode(buffer: Buffer): Response {
  const type = buffer.readInt8(0);
  switch (type) {
    case RESPONSES_RESULT.EMPTY:
      return new Empty();
    case RESPONSES_RESULT.ROW:
      return decodeRow(buffer.subarray(1));
    case RESPONSES_RESULT.MULTIROW:
      return decodeRows(buffer.subarray(1));
    case RESPONSES_RESULT.ERROR:
      throw new Error(
        `response error code: ${buffer.subarray(1, 2).readInt8()}`,
      );
    default:
      break;
  }
  const [val] = decodeValue(buffer);
  return val;
}
