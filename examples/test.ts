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
  const res = await db.query(
    'SELECT all *  FROM int limit ?',
    100
  )
  // await db.query(
  //   'insert into testmyspace.user(?, ?)',
  //   'test2',
  //   `a123456`,
  // )
  // const res = await db.query(
  //   'SELECT * FROM mymodel where username = ?',
  //   'sayan6'
  // )

  // const res = await db.query(
  //   'SELECT * FROM testmyspace.int where username = ?',
  //   10001n
  // )

  console.log(res, 'result=========');

}

test()
