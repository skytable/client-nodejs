import { Config } from "../src"

async function test() {
  const config = new Config(
    'root',
    'admin123456123456',
    '127.0.0.1',
    2003
  )

  const db = await config.connect()
  // await db.query('create space myspace')
  // await db.query('create model myspace.mymodel(username: string, password: string, followers: uint64, null email: string)')
  // await db.query(
  //   'insert into myspace.mymodel(?, ?, ?, ?)',
  //   'test1',
  //   'test1test1test1tet1',
  //   0,
  //   null
  // )
  // await db.query(
  //   'insert into myspace.mymodel(?, ?, ?, ?)',
  //   'test2',
  //   'test1test1test1test1test1',
  //   0,
  //   null
  // )
  // await db.query('create space testspace')
  await db.query('USE ?', 'myspace')
  await db.query("create model myspace.initTable(username: string, password: string, followers: uint64)")
  try {
    // await db.query(
    //   'select * FROM initTable'
    // )
  } catch (e) {
    console.log(e)
  }

  await db.query(
    'insert into initTable(?, ?, ?)',
    'test',
    // `a123456`,
    // 0
  )
  await db.query(
    'select * FROM initTable WHERE username = ?',
    'test',
  )
  // await db.query("select password, followers FROM myspace.mymodel WHERE username = ? and a=? and c=?",
  //   "sayan",
  //   123,
  //   50000000000,
  //   6000000000,
  //   true
  // )
  // await db.query('create model myspace.mymodel(username: string, password: string, followers: uint64')
  // await db.query(
  //   'insert into myspace.mymodel(?, ?, ?)',
  //   'rootadmin',
  //   'admin123456123456',
  //   '100_000_000'
  // )
  //
  // await db.query(
  //   'select password, followers FROM myspace.mymodel WHERE username = ?',
  //   'rootadmin',
  // )
}

test()
