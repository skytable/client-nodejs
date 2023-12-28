import { Config } from './config';
import type { Column, QueryResult, Row, Rows, SQParam } from './skytable';
import { Query } from './query';

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

function isFloat(number: number | string): boolean {
  return Number.isFinite(number) && !Number.isInteger(number);
}

export function encodeParam(param: SQParam): string {
  // 5 A binary blob [5<size>\n<payload>]
  if (Buffer.isBuffer(param)) {
    return [PARAMS_TYPE.BINARY, param.length, '\n', param.toString()].join('');
  }

  // null undefined
  if (param == null) {
    return '\x00';
  }

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
      return [PARAMS_TYPE.BOOLEAN, Number(param) === 1 ? '\x01' : 0].join('');
    default:
      throw new TypeError(`un support type: ${typeof param}, val: ${param}`);
  }
}

export function encodeParams(parameters: SQParam[]): string {
  return parameters.map(encodeParam).join('');
}

export function encodeQuery(query: Query): Buffer {
  const dataframe = `${query.getQuery()}${query.getParams().join('')}`;
  const data = [query.getQueryLength(), '\n', dataframe];
  const requestData = ['S', data.join('').length, '\n', ...data];

  return Buffer.from(requestData.join(''), 'utf-8');
}

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

function parseNextBySize(size: number, buffer: Buffer): [Column[], Buffer] {
  let values = [];
  let nextBuffer = buffer;

  for (let i = 0; i < size; i++) {
    const [value, remainingBuffer] = parseSingleVal(nextBuffer);
    values.push(value);
    nextBuffer = remainingBuffer;
  }

  return [values, nextBuffer];
}

function parseSingleVal(buffer: Buffer): [Column, Buffer] {
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
        Column,
        Buffer,
      ];
    }
    default:
      throw new Error(`Unknown data type: ${type}`);
  }
}

export function formatRow(buffer: Buffer): Row {
  const offset = getFirstSplitOffset(buffer);
  const columnCount = Number(buffer.subarray(0, offset).toString('utf-8'));
  const dataType = buffer.subarray(offset + 1);

  const [row] = parseNextBySize(columnCount, dataType);

  return row;
}

export function formatRows(buffer: Buffer): Rows {
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
      break;
  }

  const [val] = parseSingleVal(buffer);

  return val;
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
