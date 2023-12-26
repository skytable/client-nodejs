import Config from '../src';

export function getDBConfig() {
  return new Config('root', 'admin123456123456', '127.0.0.1', 2003);
}

export async function getSpace(
  db: any,
  space = 'testspace',
): Promise<[string, Function]> {
  await db.query(`CREATE SPACE IF NOT EXISTS ${space}`);

  await db.query(`USE ${space}`);

  return [
    space,
    async () => await db.query(`DROP SPACE ALLOW NOT EMPTY ${space}`),
  ];
}

export async function getTable(db: any): Promise<[string, Function]> {
  const [space, drop] = await getSpace(db, `testTable${Date.now()}Space`);

  return [`${space}.testTable${Date.now()}`, drop as Function];
}
