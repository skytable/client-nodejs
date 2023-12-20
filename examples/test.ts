import { Row } from './../src/skytable';
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
      `INSERT INTO ${tableName}(?, ?, ?)`,
      'test',
      'password',
      null
    )
    const row = await db.query(`SELECT * FROM ${tableName} WHERE username = ?`, 'test')
    const [username, password, email_id] = (row as Row);
    console.assert(username === 'test');
    console.assert(password === 'password');
    console.assert(email_id == null);
  } finally {
    config.disconnect();
  }
}

test()
