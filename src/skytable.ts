import { Socket } from 'node:net';
import { TLSSocket } from 'node:tls';
import { connectionWrite } from './connection';
import { encodeQuery, decodeResponse } from './protocol';
import { Query } from './query';

export type ColumnBase = string | number | boolean | null | bigint;
export type SQParam<T = ColumnBase> = T | SQParam<T>[];
export type ColumnBinary = typeof Buffer;
export type ColumnList<T> = T | ColumnList<T>[];
export type Column =
  | Buffer
  | ColumnBase
  | ColumnBinary
  | ColumnList<ColumnBase>;
export type Row = Column[];
export type Rows = Row[];
export type QueryResult = Column | Row | Rows;

/**
 * create a db instance
 * @param connection The connection to Skytable
 * @returns { query: (query: string | Query, ...params: SQParam[]) => Promise<QueryResult> }
 */
export function createDB(connection: Socket | TLSSocket) {
  const query = async (
    query: string | Query,
    ...params: SQParam[]
  ): Promise<QueryResult> => {
    const queryInstance = typeof query === 'string' ? new Query(query) : query;
    params.forEach((param) => {
      queryInstance.pushParam(param);
    });
    const buffer = encodeQuery(queryInstance);
    const res = await connectionWrite(connection, buffer);
    return decodeResponse(res);
  };
  return {
    query,
  };
}
