import { Config } from "./Config";
import { SQParam } from "@types/skytable";

const RESPONSES_RESULT = {
  ERROR: 0x10,
  ROW: 0x11,
  EMPTY: 0x12,
  MULTIROW: 0x13,
};

const HANDSHAKE_RESULT = {
  SUCCESS: "H00",
  ERROR: "H01",
};

function isFloat(number) {
  return Number.isFinite(number) && !Number.isInteger(number);
}

export function encodeParams(parameters: SQParam[]): string {
  if (!parameters.length) {
    return "";
  }

  return parameters
    .map((param) => {
      switch (typeof param) {
        case "string":
          return ["\x06", param.length, "\n", param].join("");
        case "number":
          // 2 Unsigned integer 64
          // 3 Signed integer 64
          // 4 Float A 64-bit
          return [isFloat(param) ? "\x04" : "\x03", Number(param), "\n"].join(
            ""
          );
        case "bigint":
          return ["\x02", Number(param), "\n"].join("");
        // TODO 5 A binary blob [5<size>\n<payload>]
        case "boolean":
          return ["\x01", Number(param) === 1 ? "\x01" : 0].join("");
        default:
          // null undefined
          if (param == null) {
            return 0;
          }
          throw new TypeError(
            `un support type: ${typeof param}, val: ${param}`
          );
      }
    })
    .join("");
}

function getFirstSplitOffset(buffer: Buffer, split = "\n") {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === split.charCodeAt(0)) {
      return i;
    }
  }
  return -1; // If '\n' is not found
}

function parseNext(val: SQParam, buffer: Buffer): SQParam[] {
  return [val, ...parseSkytableData(buffer)];
}

function parseSkytableData(buffer: Buffer): SQParam[] {
  if (!buffer.length) {
    return [];
  }

  const type = buffer.readUInt8(0);
  buffer = buffer.subarray(1);

  switch (type) {
    case 0: // Null
      return parseNext(null, buffer.subarray(1));
    case 1: // Bool
      return parseNext(Boolean(buffer.readUInt8(0)), buffer.subarray(1));
    case 2: // 8-bit Unsigned Integer
      return parseNext(buffer.readUInt8(0), buffer.subarray(1))
    case 3: // 16-bit Unsigned Integer
      return parseNext(buffer.readUInt16BE(1), buffer.subarray(2))
    case 4: // 32-bit Unsigned Integer
    return parseNext(buffer.readUInt32BE(4), buffer.subarray(5))
    case 5: // 64-bit Unsigned Integer
    return parseNext(buffer.readBigInt64BE(8), buffer.subarray(9))
    case 6: // 8-bit Signed Integer
      return parseNext(buffer.readInt8(0), buffer.subarray(1))
    case 7: // 16-bit Signed Integer
    return parseNext(buffer.readInt16BE(1), buffer.subarray(2))
    case 8: // 32-bit Signed Integer
    return parseNext(buffer.readInt16BE(4), buffer.subarray(5))
    case 9: // 64-bit Signed Integer
    return parseNext(buffer.readBigInt64BE(8), buffer.subarray(9))
    case 10: // f32
    return parseNext(buffer.readFloatBE(4), buffer.subarray(5))
    case 11: // f64
    return parseNext(buffer.readFloatBE(8), buffer.subarray(9))
    case 12: //  0x0C => self.__resume_psize::<Vec<u8>>(md),
      // TODO const size = _buffer
      return [];
    case 13: { // String <size>\n<body>
      const sizeOffset = getFirstSplitOffset(buffer);
      if (sizeOffset === -1) {
        return [];
      }

      const size = Number(buffer.subarray(0, sizeOffset).toString("utf-8"));
      const [start, end] = [sizeOffset + 1, sizeOffset + 1 + Number(size)];
      const str = buffer.subarray(start, end).toString("utf-8");

      return parseNext(str, buffer.subarray(end))
    }
    case 14: // TODO unknown type
      return [];
    default:
      throw new Error(`Unknown data type: ${type}`);
  }
}

export function formatRow(buffer: Buffer) {
  const offset = getFirstSplitOffset(buffer);
  // TODO Error
  if (offset === -1) return [];
  // TODO Why do we need it?
  const columnCount = Number(buffer.subarray(0, offset).toString("utf-8"));
  const dataType = buffer.subarray(offset + 1);

  return parseSkytableData(dataType);
}

export function formatRows(arr: Buffer) {
  return arr;
}

export function formatResponse(res: Buffer) {
  const type = res.readInt8(0);
  // TODO Format all

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
        message: "error code " + res.subarray(1, 2).readInt8(),
      };
    default:
      throw new TypeError("unknown response type");
  }
}

export function getClientHandshake(config: Config): string {
  const username = config.getUsername();
  const password = config.getPassword();

  return [
    "H\x00\x00\x00\x00\x00",
    username.length,
    "\n",
    password.length,
    "\n",
    username,
    password,
  ].join("");
}

export function bufferToHandshakeResult(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const [h, c1, c2, msg] = Array.from(buffer.toJSON().data);
    const code = [String.fromCharCode(h), c1, c2].join("");

    if (code === HANDSHAKE_RESULT.SUCCESS) {
      return resolve();
    }

    reject(new Error(`handshake error code ${code}, msg: ${msg}`));
  });
}
