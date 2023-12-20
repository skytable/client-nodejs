import { Config } from './config';
import type { Column, QueryResult, Row, Rows, SQParam } from './skytable';

const PARAMS_TYPE = {
  NULL: '\x00',
  BOOLEAN: '\x01',
  UINT: '\x02',
  SINT: '\x03',
  FLOAT: '\x04',
  BINARY: '\x05',
  STRING: '\x06',
};

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

const HANDSHAKE_RESULT = {
  SUCCESS: 'H00',
  ERROR: 'H01',
};

function isResponsesResult(type: number): boolean {
  return Object.values(RESPONSES_RESULT).includes(type);
}

function isFloat(number: number | string): boolean {
  return Number.isFinite(number) && !Number.isInteger(number);
}

export function encodeParams(parameters: SQParam[]): string {
  if (!parameters.length) {
    return '';
  }

  return parameters
    .map((param) => {
      switch (typeof param) {
        case 'string':
          return [PARAMS_TYPE.STRING, param.length, '\n', param].join('');
        case 'number':
          // 2 Unsigned integer 64
          // 3 Signed integer 64
          // 4 Float A 64-bit
          return [
            isFloat(param)
              ? PARAMS_TYPE.FLOAT
              : param < 0
                ? PARAMS_TYPE.SINT
                : PARAMS_TYPE.UINT,
            String(param),
            '\n',
          ].join('');
        case 'bigint':
          return [
            param < 0 ? PARAMS_TYPE.SINT : PARAMS_TYPE.UINT,
            String(param),
            '\n',
          ].join('');
        case 'boolean':
          return [PARAMS_TYPE.BOOLEAN, Number(param) === 1 ? '\x01' : 0].join(
            '',
          );
        default:
          // 5 A binary blob [5<size>\n<payload>]
          if (Buffer.isBuffer(param)) {
            return [
              PARAMS_TYPE.BINARY,
              param.length,
              '\n',
              param.toString(),
            ].join('');
          }
          // null undefined
          if (param == null) {
            return '\x00';
          }
          throw new TypeError(
            `un support type: ${typeof param}, val: ${param}`,
          );
      }
    })
    .join('');
}

function getFirstSplitOffset(buffer: Buffer, split = '\n'): number {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === split.charCodeAt(0)) {
      return i;
    }
  }
  return -1;
}

function parseNumberNext<T = number>(
  formatFn: (string: string) => T,
  buffer: Buffer,
): Column[] {
  const offset = getFirstSplitOffset(buffer);
  const val = formatFn(buffer.subarray(0, offset).toString('utf-8'));

  return parseNext(val, buffer.subarray(offset + 1));
}

function parseNext(val: any, buffer: Buffer): Column[] {
  return [val, ...parseSkytableData(buffer)];
}

function parseSkytableData(buffer: Buffer): Column[] {
  if (!buffer.length) {
    return [];
  }

  const type = buffer.readUInt8(0);
  buffer = buffer.subarray(1);

  switch (type) {
    case RESPONSES_RESULT.NULL: // Null
      return parseNext(null, buffer.subarray(0));
    case RESPONSES_RESULT.BOOL: // Bool
      return parseNext(Boolean(buffer.readUInt8(0)), buffer.subarray(1));
    case RESPONSES_RESULT.U8INT: // 8-bit Unsigned Integer
      return parseNumberNext(Number, buffer);
    case RESPONSES_RESULT.U16INT: // 16-bit Unsigned Integer
      return parseNumberNext(Number, buffer);
    case RESPONSES_RESULT.U32INT: // 32-bit Unsigned Integer
      return parseNumberNext(Number, buffer);
    case RESPONSES_RESULT.U64INT: // 64-bit Unsigned Integer
      return parseNumberNext<bigint>(BigInt, buffer);
    case RESPONSES_RESULT.S8INT: // 8-bit Signed Integer
      return parseNumberNext(Number, buffer);
    case RESPONSES_RESULT.S16INT: // 16-bit Signed Integer
      return parseNumberNext(Number, buffer);
    case RESPONSES_RESULT.S32INT: // 32-bit Signed Integer
      return parseNumberNext(Number, buffer);
    case RESPONSES_RESULT.S64INT: // 64-bit Signed Integer
      return parseNumberNext<bigint>(BigInt, buffer);
    case RESPONSES_RESULT.FLOAT32: // f32
      return parseNumberNext(Number.parseFloat, buffer);
    case RESPONSES_RESULT.FLOAT64: // f64
      return parseNumberNext(Number.parseFloat, buffer);
    case RESPONSES_RESULT.BINARY: {
      //  Binary <size>\n<payload>,
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      if (size === 0) {
        return parseNext(Buffer.from([]), buffer.subarray(sizeOffset + 1));
      }
      const [start, end] = [sizeOffset + 1, sizeOffset + 1 + Number(size)];

      return parseNext(buffer.subarray(start, end), buffer.subarray(end));
    }
    case RESPONSES_RESULT.STRING: {
      // String <size>\n<body>
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      const [start, end] = [sizeOffset + 1, sizeOffset + 1 + Number(size)];
      const str = buffer.subarray(start, end).toString('utf-8');

      return parseNext(str, buffer.subarray(end));
    }
    case RESPONSES_RESULT.LIST: {
      // List <size>\n<body>
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      if (size === 0) {
        return parseNext([], buffer.subarray(sizeOffset + 1));
      }
      return [parseSkytableData(buffer.subarray(sizeOffset + 1)) as Column];
    }
    default:
      throw new Error(`Unknown data type: ${type}`);
  }
}

export function formatRow(buffer: Buffer): Row {
  const offset = getFirstSplitOffset(buffer);
  // const columnCount = Number(buffer.subarray(0, offset).toString("utf-8"))
  const dataType = buffer.subarray(offset + 1);

  return parseSkytableData(dataType);
}

export function formatRows(buffer: Buffer): Rows {
  const offset = getFirstSplitOffset(buffer);
  const rowCount = Number(buffer.subarray(0, offset).toString('utf-8'));

  buffer = buffer.subarray(offset + 1);

  const columnOffset = getFirstSplitOffset(buffer);
  const columnCount = Number(
    buffer.subarray(0, columnOffset).toString('utf-8'),
  );
  const tableData: Column[] = parseSkytableData(buffer.subarray(offset + 1));

  const result: Rows = [];

  for (let i = 0; i < rowCount; i++) {
    result[i] = [];
    for (let j = 0; j < columnCount; j++) {
      result[i][j] = tableData[i * columnCount + j];
    }
  }

  return result;
}

export function formatResponse(buffer: Buffer): QueryResult {
  const type = buffer.readInt8(0);

  switch (type) {
    case RESPONSES_RESULT.EMPTY:
      return null;
    case RESPONSES_RESULT.ROW:
      return formatRow(buffer.subarray(1));
    case RESPONSES_RESULT.MULTIROW:
      return formatRows(buffer.subarray(1));
    case RESPONSES_RESULT.ERROR:
      throw new Error(
        `response error code: ${buffer.subarray(1, 2).readInt8()}`,
      );
    default:
      if (isResponsesResult(type)) {
        const result = parseSkytableData(buffer);
        // FIXME to be better
        return result?.[0];
      }
      throw new TypeError('unknown response type');
  }
}

export function getClientHandshake(config: Config): string {
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

export function bufferToHandshakeResult(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const [h, c1, c2, msg] = Array.from(buffer.toJSON().data);
    const code = [String.fromCharCode(h), c1, c2].join('');

    if (code === HANDSHAKE_RESULT.SUCCESS) {
      return resolve();
    }

    reject(new Error(`handshake error code ${code}, msg: ${msg}`));
  });
}
