import { Config } from "../src"

async function test() {
  const config = new Config(
    'root',
    'admin123456123456',
    '127.0.0.1',
    2003
  )

  const db = await config.connect()
  // await db.query('create space testmyspace')
  await db.query('USE testmyspace')
  // await db.query("create model testmyspace.user(username: string, password: string)")
  await db.query(
    'insert into testmyspace.user(?, ?)',
    'test1',
    `a123456`,
  )
  const [username, password] = await db.query(
    'select * FROM testmyspace.user WHERE username = ? and password = ?',
    'test1',
    'a123456'
  )

  console.log(username, password, 'result=========');
  
}

test()
