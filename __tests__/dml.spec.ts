import type { Rows } from '../src';
import { getDBConfig, getTable } from './utils';

describe('DML', () => {
  let db: any;
  const dbConfig = getDBConfig();

  beforeAll(async () => {
    db = await dbConfig.connect();
  });

  afterAll(async () => {
    dbConfig.disconnect();
  });

  it('null type', async () => {
    const [tableName, drop] = await getTable(db);
    try {
      await db.query(
        `CREATE MODEL ${tableName}(username: string, null email_id: string)`,
      );

      await db.query(`INSERT INTO ${tableName}(?, ?)`, 'test', null);

      expect(
        await db.query(
          `SELECT username,email_id FROM ${tableName} WHERE username = ?`,
          'test',
        ),
      ).toEqual(['test', null]);
    } finally {
      await drop();
    }
  });

  it('int number type', async () => {
    const [tableName, drop] = await getTable(db);

    try {
      await db.query(
        `CREATE MODEL ${tableName}(u8: uint8, u16: uint16, u32: uint32, u64: uint64)`,
      );

      await db.query(
        `INSERT INTO ${tableName}(?, ?, ?, ?)`,
        1,
        2,
        3312321,
        BigInt(478787872837218382),
      );

      // TODO why is the uint8 in bigint
      expect(
        await db.query(`SELECT * FROM ${tableName} WHERE u8 = ?`, 1),
      ).toEqual([BigInt(1), 2, 3312321, BigInt(478787872837218382)]);
    } finally {
      await drop();
    }
  });

  it('list type', async () => {
    const [tableName, drop] = await getTable(db);

    try {
      await db.query(
        `CREATE MODEL ${tableName}(id: uint64, list: list { type: string} )`,
      );

      await db.query(`INSERT INTO ${tableName}(?, [?])`, 1, 'test');

      expect(
        await db.query(`SELECT * FROM ${tableName} WHERE id = ?`, 1),
      ).toEqual([BigInt(1), ['test']]);
    } finally {
      await drop();
    }
  });

  it('binary type', async () => {
    const [tableName, drop] = await getTable(db);

    try {
      await db.query(`CREATE MODEL ${tableName}(id: uint64, binary: binary )`);

      await db.query(`INSERT INTO ${tableName}(?, ?)`, 1, Buffer.from('test'));

      expect(
        await db.query(`SELECT * FROM ${tableName} WHERE id = ?`, 1),
      ).toEqual([BigInt(1), Buffer.from('test')]);
    } finally {
      await drop();
    }
  });

  it('Multirow', async () => {
    const [tableName, drop] = await getTable(db);

    try {
      await db.query(`CREATE MODEL ${tableName}(id: string, name: string )`);
      for (let i = 0; i < 10; i++) {
        await db.query(`INSERT INTO ${tableName}(?, ?)`, String(i), 'test');
      }
      const rows = (await db.query(
        `SELECT ALL * FROM ${tableName} LIMIT ?`,
        10,
      )) as Rows;

      expect(
        rows.sort((row1, row2) =>
          Number(row1[0] as string) > Number(row2[0] as string) ? 1 : -1,
        ),
      ).toEqual([
        ...Array.from({ length: 10 }).map((_, index) => [
          String(index),
          'test',
        ]),
      ]);
    } finally {
      await drop();
    }
  });
});
