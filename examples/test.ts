import { Config } from "../src"

async function test() {
  const config = new Config(
    'root',
    'admin123456123456',
    '127.0.0.1',
    2003
  )
  const spaceName = `testTable${Date.now()}Space`;
  const tableName = `${spaceName}.testTable`;
  const db = await config.connect()

  try {
    await db.query('create space ' + spaceName)
    await db.query('use ' + spaceName)
    await db.query(`CREATE MODEL ${tableName}(username: string, password: string, null email_id: string)`)
    await db.query(
      `INSERT INTO ${tableName} { username: ?, password: ?, email_id: ? }`,
      'test',
      'password',
      null
    )
  } finally {
    // db.query('DROP SPACE ALLOW NOT EMPTY ' + spaceName)

    config.disconnect();
  }
}

test()
