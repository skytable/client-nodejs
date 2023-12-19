import { Config } from "../src";

export function getDBConfig() {
  return new Config(
    'root',
    'admin123456123456',
    '127.0.0.1',
    2003
  );
}

export async function getSpace(db: any, space = 'testspace') {
  const isNotCreated = await db.query(`CREATE SPACE IF NOT EXISTS ${space}`);

  if (isNotCreated) {
    await db.query(`CREATE SPACE ${space}`);
  }

  await db.query(`USE ${space}`);

  afterAll(async () => {
    await db.query(`DROP SPACE ALLOW NOT EMPTY ${space}`);
  })

  return space;
}

export async function getTable(db: any) {
  const space = await getSpace(db, `testTableSpace${Date.now()}`);
  const isNotCreated = await db.query(`CREATE SPACE IF NOT EXISTS ${space}`);

  if (isNotCreated) {
    await db.query(`CREATE SPACE ${space}`);
  }

  await db.query(`USE ${space}`);

  afterAll(async () => {
    await db.query(`DROP SPACE ALLOW NOT EMPTY ${space}`);
  })

  return `${space}.testTable${Date.now()}`;
}