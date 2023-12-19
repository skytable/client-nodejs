import { Config } from './config';
import { SQParam } from './skytable.d';

const RESPONSES_RESULT = {
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

export function encodeParams(parameters: SQParam[]): string {
  if (!parameters.length) {
    return '';
  }

  return parameters
    .map((param) => {
      switch (typeof param) {
        case 'string':
          return ['\x06', param.length, '\n', param].join('');
        case 'number':
          // 2 Unsigned integer 64
          // 3 Signed integer 64
          // 4 Float A 64-bit
          return [
            isFloat(param) ? '\x04' : param < 0 ? '\x03' : '\x02',
            String(param),
            '\n',
          ].join('');
        case 'bigint':
          return [param < 0 ? '\x03' : '\x02', String(param), '\n'].join('');
        case 'boolean':
          return ['\x01', Number(param) === 1 ? '\x01' : 0].join('');
        default:
          // 5 A binary blob [5<size>\n<payload>]
          if (Buffer.isBuffer(param)) {
            return ['\x05', Buffer.byteLength(param), '\n', (new Uint8Array(Array.from(param))).join('')].join('');
          }
          // null undefined
          if (param == null) {
            return 0;
          }
          throw new TypeError(
            `un support type: ${typeof param}, val: ${param}`,
          );
      }
    })
    .join('');
}

function getFirstSplitOffset(buffer: Buffer, split = '\n') {
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
) {
  const offset = getFirstSplitOffset(buffer);
  const val = formatFn(buffer.subarray(0, offset).toString('utf-8'));

  return parseNext(val, buffer.subarray(offset + 1));
}

function parseNext(val: any, buffer: Buffer): SQParam[] {
  return [val, ...parseSkytableData(buffer)];
}

function parseSkytableData(buffer: Buffer): any[] {
  if (!buffer.length) {
    return [];
  }

  const type = buffer.readUInt8(0);
  buffer = buffer.subarray(1);

  switch (type) {
    case 0: // Null
      return parseNext(null, buffer.subarray(0));
    case 1: // Bool
      return parseNext(Boolean(buffer.readUInt8(0)), buffer.subarray(1));
    case 2: // 8-bit Unsigned Integer
      return parseNumberNext(Number, buffer);
    case 3: // 16-bit Unsigned Integer
      return parseNumberNext(Number, buffer);
    case 4: // 32-bit Unsigned Integer
      return parseNumberNext(Number, buffer);
    case 5: // 64-bit Unsigned Integer
      return parseNumberNext(BigInt, buffer);
    case 6: // 8-bit Signed Integer
      return parseNumberNext(Number, buffer);
    case 7: // 16-bit Signed Integer
      return parseNumberNext(Number, buffer);
    case 8: // 32-bit Signed Integer
      return parseNumberNext(Number, buffer);
    case 9: // 64-bit Signed Integer
      return parseNumberNext<bigint>(BigInt, buffer);
    case 10: // f32
      return parseNumberNext<number>(Number.parseFloat, buffer);
    case 11: // f64
      return parseNumberNext<number>(Number.parseFloat, buffer);
    case 12: {
      //  Binary <size>\n<payload>,
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      if (size === 0) {
        return parseNext(Buffer.from([]), buffer.subarray(sizeOffset + 1));
      }
      const [start, end] = [sizeOffset + 1, sizeOffset + 1 + Number(size)];

      return parseNext(buffer.subarray(start, end), buffer.subarray(end));
    }
    case 13: {
      // String <size>\n<body>
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      const [start, end] = [sizeOffset + 1, sizeOffset + 1 + Number(size)];
      const str = buffer.subarray(start, end).toString('utf-8');

      return parseNext(str, buffer.subarray(end));
    }
    case 14: {
      // List <size>\n<body>
      const sizeOffset = getFirstSplitOffset(buffer);
      const size = Number(buffer.subarray(0, sizeOffset).toString('utf-8'));
      if (size === 0) {
        return parseNext([], buffer.subarray(sizeOffset + 1));
      }
      return [parseSkytableData(buffer.subarray(sizeOffset + 1))];
    }
    default:
      throw new Error(`Unknown data type: ${type}`);
  }
}

export function formatRow(buffer: Buffer) {
  const offset = getFirstSplitOffset(buffer);
  // const columnCount = Number(buffer.subarray(0, offset).toString("utf-8"))
  const dataType = buffer.subarray(offset + 1);

  return parseSkytableData(dataType);
}

export function formatRows(buffer: Buffer) {
  const offset = getFirstSplitOffset(buffer);
  const rowCount = Number(buffer.subarray(0, offset).toString('utf-8'));

  buffer = buffer.subarray(offset + 1);

  const columnOffset = getFirstSplitOffset(buffer);
  const columnCount = Number(
    buffer.subarray(0, columnOffset).toString('utf-8'),
  );
  const tableData = parseSkytableData(buffer.subarray(offset + 1));

  const result = [];
  for (let i = 0; i < rowCount; i++) {
    result[i] = [];
    for (let j = 0; j < columnCount; j++) {
      result[i][j] = tableData[i * columnCount + j];
    }
  }
  return result;
}

export function formatResponse(res: Buffer) {
  const type = res.readInt8(0);

  switch (type) {
    case RESPONSES_RESULT.EMPTY:
      return { success: true, data: [] };
    case RESPONSES_RESULT.ROW:
      return { success: true, data: formatRow(res.subarray(1)) };
    case RESPONSES_RESULT.MULTIROW:
      return { success: true, data: formatRows(res.subarray(1)) };
    case RESPONSES_RESULT.ERROR:
      return {
        success: false,
        data: [],
        message: 'error code ' + res.subarray(1, 2).readInt8(),
      };
    default:
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
