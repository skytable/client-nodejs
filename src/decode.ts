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

// TODO error for ROW | LIST | ROWS
export function decode(buffer: Buffer) {
  const resultType = buffer.readInt8(0);
  let sourceBuffer = buffer.subarray(1);
  let cursor = 0;

  // @ts-ignore
  let value = undefined;
  let isPending = true;

  const state = {
    list: { offset: 0, size: 0 },
    row: { offset: 0, size: 0 },
    rows: { offset: 0, rowSize: 0, comOffset: 0, comSize: 0 },
  }

  const setValue = (val: any, offset = 0) => {
    value = val;
    cursor += offset;
    isPending = false;
  }

  const getNextSplitOffset = (): number => {
    for (let i = cursor; i < sourceBuffer.length; i++) {
      if (sourceBuffer[i] === '\n'.charCodeAt(0)) {
        return i;
      }
    }

    isPending = true;
    return -1;
  }
  

  const parseNumber = <T = number>(
    formatFn: (string: string) => T
  ) => {
    const offset = getNextSplitOffset();
    if (offset === -1) {
      return;
    }
    const val = formatFn(sourceBuffer.subarray(cursor, offset).toString('utf-8'));
console.log(sourceBuffer, sourceBuffer.subarray(cursor, offset), cursor, offset + 1, 'llllllllllllllll', val)
    setValue(val, offset - cursor + 1)
  }

  const decodeValue = () => {
    switch (resultType) {
      case RESPONSES_RESULT.NULL: // Null
        return setValue(null);
      case RESPONSES_RESULT.BOOL: // Bool
        return setValue(Boolean(sourceBuffer.readUInt8(cursor)), 1);
      case RESPONSES_RESULT.U8INT: // 8-bit Unsigned Integer
        return parseNumber(Number);
      case RESPONSES_RESULT.U16INT: // 16-bit Unsigned Integer
        return parseNumber(Number);
      case RESPONSES_RESULT.U32INT: // 32-bit Unsigned Integer
        return parseNumber(Number);
      case RESPONSES_RESULT.U64INT: // 64-bit Unsigned Integer
        return parseNumber<bigint>(BigInt);
      case RESPONSES_RESULT.S8INT: // 8-bit Signed Integer
        return parseNumber(Number);
      case RESPONSES_RESULT.S16INT: // 16-bit Signed Integer
        return parseNumber(Number);
      case RESPONSES_RESULT.S32INT: // 32-bit Signed Integer
        return parseNumber(Number);
      case RESPONSES_RESULT.S64INT: // 64-bit Signed Integer
        return parseNumber<bigint>(BigInt);
      case RESPONSES_RESULT.FLOAT32: // f32
        return parseNumber(Number.parseFloat);
      case RESPONSES_RESULT.FLOAT64: // f64
        return parseNumber(Number.parseFloat);
      case RESPONSES_RESULT.BINARY: {
        //  Binary <size>\n<payload>,
        const sizeOffset = getNextSplitOffset();
        if (sizeOffset === -1) {
          return;
        }

        const size = Number(sourceBuffer.subarray(cursor, sizeOffset).toString('utf-8'));
        const [start, end] = [cursor, sizeOffset + Number(size)];

        if (end > sourceBuffer.length) {
          isPending = true;
          return;
        }
        setValue(sourceBuffer.subarray(start, end), end - cursor)
        break;
      }
      case RESPONSES_RESULT.STRING: {
        // String <size>\n<body>
        const sizeOffset = getNextSplitOffset();

        if (sizeOffset === -1) {
          return;
        }
        const size = Number(sourceBuffer.subarray(cursor, sizeOffset).toString('utf-8'));
        const [start, end] = [sizeOffset + 2, sizeOffset + 2 + Number(size)];
        

        if (end > sourceBuffer.length) {
          isPending = true;
          return;
        }

        const str = buffer.subarray(start, end).toString('utf-8');
        setValue(str, end - cursor);

        break;
      }
      case RESPONSES_RESULT.LIST: {
        // List <size>\n<body>
        const sizeOffset = state.list.offset ? state.list.offset : getNextSplitOffset();
        state.list.offset = sizeOffset;

        if (sizeOffset === -1) {
          return;
        }

        const isHistory = Boolean(state.list.size);
        const size = state.list.size ? state.list.size : Number(sourceBuffer.subarray(cursor, sizeOffset).toString('utf-8'));
        state.list.size = size;
        if (size === 0) {
          setValue([], sizeOffset + 1 - cursor)
        }
        if (!isHistory) {
          cursor += 1;
        }
        
        // @ts-ignore
        let values = (value || []);
        for (let i = values.length; i < size; i++) {
          const { value: innerValue, isPending: innerPending, cursor: innerCursor } = decode(sourceBuffer.subarray(cursor));
          if (innerPending) {
            break;
          }

          values[i] = innerValue;
          cursor += innerCursor;
        }

        setValue(values)
        break;
      }
      default:
        throw new Error(`Unknown data type: ${resultType}`);
    }
  }

  const decodeResponse = () => {
    switch (resultType) {
      case RESPONSES_RESULT.EMPTY:
        setValue(null);
        break;
      case RESPONSES_RESULT.ROW:
        {
          const offset = state.row.offset ? state.row.offset : getNextSplitOffset();
          state.row.offset = offset;
          if (offset === -1) {
            return;
          }

          const columnCount = state.row.size ? state.row.size : Number(sourceBuffer.subarray(cursor, offset).toString('utf-8'));
          state.row.size = columnCount;

          cursor = offset + 1;
          if (columnCount === 0) {
            return setValue([]);
          }

          // @ts-ignore
          let row = (value || []);
          const start = row.length;
          for (let i = start; i < columnCount; i++) {
            const { value: innerValue, isPending: innerPending, cursor: innerCursor } = decode(sourceBuffer.subarray(cursor));
            if (innerPending) {
              break;
            }

            row[i] = innerValue;
            cursor += innerCursor;
          }

          setValue(row)

          break;
        }
      case RESPONSES_RESULT.MULTIROW:
        const isHistory = Boolean(state.rows.offset);
        const offset = state.rows.offset ? state.rows.offset : getNextSplitOffset();
        state.rows.offset = offset;
        if (offset === -1) {
          return;
        }

        const rowCount = Number(sourceBuffer.subarray(cursor, offset).toString('utf-8'));
        state.rows.rowSize = rowCount;

        if (rowCount === 0) {
          return setValue([], offset + 1 - cursor);
        }

        
        if (!isHistory) {
          cursor += 1;
        }

        const isColumnHistory = Boolean(state.rows.offset);
        const columnOffset = state.rows.comOffset ? state.rows.comOffset : getNextSplitOffset();
        state.rows.comOffset = columnOffset;
        if (offset === -1) {
          return;
        }
        const columnCount = state.rows.comSize ? state.rows.comSize : Number(
          sourceBuffer.subarray(cursor, columnOffset).toString('utf-8'),
        );
        state.rows.comSize = columnCount;

        if (!isColumnHistory) {
          cursor += 1;
        }

        // @ts-ignore
        const rows = value || [];
        let nextBuffer = sourceBuffer;
        for (let i = rows.length; i < rowCount; i++) {
          const row = rows[i];
          const count = row?.length || 0;

          for (let j = count; j < columnCount; j++) {
            const { value: innerValue, isPending: innerPending, cursor: innerCursor } = decode(nextBuffer.subarray(cursor));

            if (innerPending) {
              break;
            }

            row[j] = innerValue;
            cursor += innerCursor;
          }
        }

        setValue(rows);
        break;
      case RESPONSES_RESULT.ERROR:
        throw new Error(
          `response error code: ${sourceBuffer.subarray(1, 2).readInt8()}`,
        );
      default:
        decodeValue();
    }
  }


  decodeResponse();
  return {
    value,
    cursor,
    isPending,
    next(nextBuffer: Buffer) {
      sourceBuffer = Buffer.concat([sourceBuffer, nextBuffer]);
      decodeResponse();

      return this;
    }
  }
}