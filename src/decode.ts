import type {
  Column,
  ColumnBase,
  ColumnList,
  QueryResult,
  Row,
  Rows,
} from './skytable';

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

export class Decode {
  private _isComplete: boolean = false;
  public buffer: Buffer | null = null;
  public overflowBuffer: Buffer = Buffer.from([]);
  private value: QueryResult | undefined;
  private result: { [key: string]: unknown } = {};

  constructor(buffer?: Buffer) {
    if (buffer) {
      this.buffer = buffer;
      this.overflowBuffer = buffer;
      this.decode();
    }
  }

  public get isComplete(): boolean {
    return this._isComplete;
  }

  public set isComplete(value: boolean) {
    this._isComplete = value;
  }

  getValue() {
    return this.value;
  }

  getOverflowBuffer() {
    return this.overflowBuffer;
  }

  setValue(value: QueryResult, isComplete?: boolean) {
    this.isComplete = isComplete != null ? isComplete : true;
    this.value = value;
  }

  setResult(values: { [key: string]: any }) {
    this.result = {
      ...this.result,
      ...values,
    };
  }

  pushBuffer(buffer: Buffer) {
    if (this.buffer) {
      this.buffer = Buffer.concat([this.buffer, buffer]);
    } else {
      this.buffer = buffer;
    }
  }

  pushOverflowBuffer(buffer: Buffer) {
    this.overflowBuffer = Buffer.concat([this.overflowBuffer, buffer]);
  }

  sliceBuffer(start: number, end: number, overflowOffset: number = 0) {
    const result = this.overflowBuffer.subarray(start, end);
    this.overflowBuffer = this.overflowBuffer.subarray(end + overflowOffset);

    return result;
  }

  getType() {
    if (this.result.type != null) {
      return this.result.type;
    }

    const type = this.sliceBuffer(0, 1).readInt8();

    this.setResult({ type });

    return type;
  }

  getNextSplitOffset(): number {
    for (let i = 0; i < this.overflowBuffer.length; i++) {
      if (this.overflowBuffer[i] === '\n'.charCodeAt(0)) {
        return i;
      }
    }

    return -1;
  }

  parseNumber<T = number>(formatFn: (string: string) => T) {
    const offset = this.getNextSplitOffset();
    if (offset === -1) {
      return;
    }
    const val: T = formatFn(this.sliceBuffer(0, offset, 1).toString('utf-8'));
    this.setValue(val as QueryResult);
  }

  parseBinary() {
    const sizeOffset = this.getNextSplitOffset();
    if (sizeOffset === -1) {
      return;
    }

    const size =
      this.result.size != null
        ? this.result.size
        : Number(this.sliceBuffer(0, sizeOffset, 1).toString('utf-8'));
    const [start, end] = [0, Number(size)];

    if (end > this.overflowBuffer.length) {
      this.setResult({
        size: size,
      });
      return;
    }

    this.setValue(this.sliceBuffer(start, end));
  }

  parseString() {
    // String <size>\n<body>
    const sizeOffset = this.getNextSplitOffset();

    if (sizeOffset === -1) {
      return;
    }
    const size =
      this.result.size != null
        ? this.result.size
        : Number(this.sliceBuffer(0, sizeOffset, 1).toString('utf-8'));
    const [start, end] = [0, Number(size)];

    if (end > this.overflowBuffer.length) {
      this.setResult({
        size: size,
      });
      return;
    }

    const str = this.sliceBuffer(start, end).toString('utf-8');
    this.setValue(str);
  }

  parseList() {
    // List <size>\n<body>
    const sizeOffset = this.getNextSplitOffset();

    if (sizeOffset === -1) {
      return;
    }

    const size: number =
      this.result.size != null
        ? (this.result.size as number)
        : Number(this.sliceBuffer(0, sizeOffset, 1).toString('utf-8'));

    if (size === 0) {
      this.setValue([]);
      return;
    }

    let i: number = (this.result.i as number) || 0;
    let list: ColumnList<ColumnBase>[] =
      (this.result.list as ColumnList<ColumnBase>[]) || [];

    while (i < size) {
      const decode = new Decode(this.overflowBuffer);
      const value = decode.getValue();
      const overflowBuffer = decode.getOverflowBuffer();

      if (!decode.isComplete) {
        this.setResult({
          size,
          i,
          list,
        });
        break;
      }

      this.overflowBuffer = overflowBuffer;
      list[i] = value as ColumnBase;
      i += 1;
    }

    this.setValue(list, list.length === size);
  }

  parseRow() {
    const sizeOffset = this.getNextSplitOffset();

    if (sizeOffset === -1) {
      return;
    }

    const size =
      this.result.size != null
        ? (this.result.size as number)
        : Number(this.sliceBuffer(0, sizeOffset, 1).toString('utf-8'));

    if (size === 0) {
      this.setValue([]);
      return;
    }

    let i: number = (this.result.i as number) || 0;
    let row: Row = (this.result.row as Row) || [];

    while (i < size) {
      const decode = new Decode(this.overflowBuffer);
      const value = decode.getValue();
      const overflowBuffer = decode.getOverflowBuffer();

      if (!decode.isComplete) {
        this.setResult({ size, i, row });
        break;
      }

      this.overflowBuffer = overflowBuffer;
      row[i] = value as Column;
      i++;
    }

    this.setValue(row, row.length === size);
  }

  parseRows() {
    const rowOffset = this.getNextSplitOffset();
    if (rowOffset === -1) {
      return;
    }

    const rowCount =
      this.result.rowCount != null
        ? (this.result.rowCount as number)
        : Number(this.sliceBuffer(0, rowOffset, 1).toString('utf-8'));

    if (rowCount === 0) {
      this.setValue([]);
      return;
    }

    const columnOffset = this.getNextSplitOffset();

    if (columnOffset === -1) {
      return;
    }

    const columnCount =
      this.result.columnCount != null
        ? (this.result.columnCount as number)
        : Number(this.sliceBuffer(0, columnOffset, 1).toString('utf-8'));

    const rows: Rows = (this.result.rows as Row[]) || [];
    const length = rows.length;
    for (let i = length; i < rowCount; i++) {
      rows[i] = rows[i] || [];
      const count = rows[i].length;
      for (let j = count; j < columnCount; j++) {
        const decode = new Decode(this.overflowBuffer);
        const value = decode.getValue();
        const overflowBuffer = decode.getOverflowBuffer();

        if (!decode.isComplete) {
          this.setResult({ rows, columnCount, rowCount });
          break;
        }

        this.overflowBuffer = overflowBuffer;
        rows[i][j] = value as Column;
      }
    }

    this.setValue(
      rows,
      rows.every((row: Row) => row.length === columnCount),
    );
  }

  decode() {
    const type = this.getType();

    switch (type) {
      case RESPONSES_RESULT.NULL: // Null
        this.setValue(null);
        break;
      case RESPONSES_RESULT.BOOL: // Bool
        this.setValue(Boolean(this.sliceBuffer(0, 1).readUInt8()));
        break;
      case RESPONSES_RESULT.U8INT: // 8-bit Unsigned Integer
        this.parseNumber(Number);
        break;
      case RESPONSES_RESULT.U16INT: // 16-bit Unsigned Integer
        this.parseNumber(Number);
        break;
      case RESPONSES_RESULT.U32INT: // 32-bit Unsigned Integer
        this.parseNumber(Number);
        break;
      case RESPONSES_RESULT.U64INT: // 64-bit Unsigned Integer
        this.parseNumber<bigint>(BigInt);
        break;
      case RESPONSES_RESULT.S8INT: // 8-bit Signed Integer
        this.parseNumber(Number);
        break;
      case RESPONSES_RESULT.S16INT: // 16-bit Signed Integer
        this.parseNumber(Number);
        break;
      case RESPONSES_RESULT.S32INT: // 32-bit Signed Integer
        this.parseNumber(Number);
        break;
      case RESPONSES_RESULT.S64INT: // 64-bit Signed Integer
        this.parseNumber<bigint>(BigInt);
        break;
      case RESPONSES_RESULT.FLOAT32: // f32
        this.parseNumber(Number.parseFloat);
        break;
      case RESPONSES_RESULT.FLOAT64: // f64
        this.parseNumber(Number.parseFloat);
        break;
      case RESPONSES_RESULT.BINARY:
        this.parseBinary();
        break;
      case RESPONSES_RESULT.STRING:
        this.parseString();
        break;
      case RESPONSES_RESULT.LIST:
        this.parseList();
        break;
      case RESPONSES_RESULT.EMPTY:
        this.setValue(null);
        break;
      case RESPONSES_RESULT.ROW:
        this.parseRow();
        break;
      case RESPONSES_RESULT.MULTIROW:
        this.parseRows();
        break;
      case RESPONSES_RESULT.ERROR:
        throw new Error(
          `response error code: ${this.sliceBuffer(0, 1).readInt8()}`,
        );
      default:
        throw new Error(`Unknown data type: ${type}`);
    }
  }

  append(buffer: Buffer) {
    this.pushBuffer(buffer);
    this.pushOverflowBuffer(buffer);

    this.decode();

    return this.isComplete;
  }
}
