import { encodeParams as encodeParam, NEWLINE, PARAMS_TYPE } from './protocol';
import { isFloat } from './utils';

/**
 * A type that can be accepted as a parameter
 */
export type Parameter =
  | null
  | boolean
  | bigint
  | number
  | Buffer
  | string
  | SQParam;

export function isSQParam(obj: any): obj is SQParam {
  return (obj as SQParam).encodeUnsafe != undefined;
}

/**
 * A query object represents a query that is to be sent to the
 */
export class Query {
  private query: string;
  private params: Uint8Array[];
  private param_cnt: number;
  /**
   * Create a new query
   *
   * @param query base query
   * @param params additional parameters
   */
  constructor(query: string | string, ...params: Parameter[]) {
    this.query = query;
    this.param_cnt = 0;
    this.params = [];
    params.forEach((param) => {
      encodeParam(this, param);
    });
  }
  /**
   * Get the base query payload
   * @returns base query
   */
  public getQuery(): String {
    return this.query;
  }
  /**
   * Get parameter count
   * @returns parameter count
   */
  public getParamCount(): number {
    return this.params.length;
  }
  /**
   * Add a new parameter to this query
   * @param param new parameter
   */
  public pushParam(param: Parameter): void {
    encodeParam(this, param);
  }
  // private
  /**
   *
   * @returns returns the parameter buffer
   */
  getParamBuffer(): Uint8Array[] {
    return this.params;
  }
  /**
   * Increment the parameter count by the given value
   *
   * @param by newly added param count
   */
  incrQueryCountBy(by: number): void {
    this.param_cnt += by;
  }
}

/**
 * If you want to use a custom parameter, implement this interface
 */
export interface SQParam {
  /**
   * Encode the parameter buffer and return the number of parameters that were added. If you were encoding an
   * object, you would return the number of keys that you encoded, for example.
   *
   * @param buf The raw parameter buffer
   */
  encodeUnsafe(buf: Uint8Array[]): number;
}

/**
 * The `SignedInt` class is meant to be used when you're trying to pass an unsigned integer into a query as a parameter. We always
 * recommend doing this because the @method Query.pushParam simply checks if the value is positive or negative and then encodes it
 * as either an unsigned int or a signed int, respectively.
 *
 * Hence, for positive values that you intended to be sent as a signed integer (as is stored in the database), use this.
 *
 * > TL;DR: use this to push parameters for signed integer columns
 */
export class SignedInt implements SQParam {
  public value: number;
  constructor(value: number) {
    if (isFloat(value)) {
      throw new TypeError('expected a non-floating point value');
    }
    this.value = value;
  }
  encodeUnsafe(buf: Uint8Array[]): number {
    buf.push(
      Buffer.concat([
        PARAMS_TYPE.SINT,
        Buffer.from(this.value.toString()),
        NEWLINE,
      ]),
    );
    return 1;
  }
}
