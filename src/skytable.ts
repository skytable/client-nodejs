import { Socket } from 'node:net';
import { TLSSocket } from 'node:tls';
import { connectionWrite } from './connection';
import { encodeParams, formatResponse } from './protocol';

export type ConnectionOptions = {
  port: number;
  hostname: string;
};

export type ConnectionTlsOptions = ConnectionOptions & { certFile: string };

type ColumnBase = string | number | boolean | null | bigint;

export type SQParam = ColumnBase;

export type ColumnBinary = typeof Buffer;

export type ColumnList<T> = T | ColumnList<T>[];

export type Column = ColumnBase | ColumnBinary | ColumnList<ColumnBase>;

export type Row = Column[];

export type Rows = Row[];

export type QueryResult = null | Row | Rows;


export function createSkytable(connection: Socket | TLSSocket) {
  const query = async (query: string, ...params: SQParam[]): Promise<QueryResult> => {
    const dataframe = `${query}${encodeParams(params)}`;
    const data = [query.length, '\n', dataframe];
    const requestData = ['S', data.join('').length, '\n', ...data];
    const buffer = Buffer.from(requestData.join(''), 'utf-8');

    const res = await connectionWrite(connection, buffer);

    return formatResponse(res);
  };

  return {
    query,
  };
}
