import { getDBConfig, getTable } from './utils'

describe('DDL', () => {
  let db: any;
  const dbConfig = getDBConfig();

  beforeAll(async () => {
    db = await dbConfig.connect()
  })

  afterAll(async () => {
    dbConfig.disconnect()
  })

  it('null type', async () => {
    const tableName = await getTable(db);

    await db.query(`CREATE MODEL ${tableName}(username: string, null email_id: string)`)

    await db.query(`INSERT INTO ${tableName}(?, ?)`, 'test', null)

    expect(await db.query(`SELECT username,email_id FROM ${tableName} WHERE username = ?`, 'test')).toEqual([
      ['test', null]
    ])
  })

  it('int number type', async () => {
    const tableName = await getTable(db);

    await db.query(`CREATE MODEL ${tableName}(u8: uint8, u16: uint16, u32: uint32, u32: uint64)`)

    await db.query(`INSERT INTO ${tableName}(?, ?, ?, ?)`, 1, 2, 3312321, BigInt(478787872837218382))

    expect(await db.query(`SELECT * FROM ${tableName} WHERE u8 = ?`, 1)).toEqual([
      [1, 2, 3312321, BigInt(478787872837218382)]
    ])
  })
});