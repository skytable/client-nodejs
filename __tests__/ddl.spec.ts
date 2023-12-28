import { getDBConfig, getSpace, getTable } from './utils';

const testSpace = 'ddltestspace';

describe('DDL', () => {
  let db: any;
  const dbConfig = getDBConfig();

  beforeAll(async () => {
    db = await dbConfig.connect();
  });

  afterAll(async () => {
    dbConfig.disconnect();
  });

  it('CREATE SPACE', async () => {
    const spaceName = `${testSpace + Date.now()}`;
    try {
      expect(await db.query(`CREATE SPACE ${spaceName}`)).toBe(null);
    } finally {
      await db.query(`DROP SPACE ALLOW NOT EMPTY ${spaceName}`);
    }
  });

  // FIXME need to fix. why need 'ALTER SPACE'?
  // it('ALTER SPACE', async () => {
  //   const spaceName = `${testSpace + Date.now()}`;
  //   try {
  //     await db.query(`CREATE SPACE IF NOT EXISTS ${spaceName} WITH { property_name: ? }`, 123);

  //     expect(await db.query(`ALTER SPACE ${spaceName} WITH { property_name: ? }`, 456)).toBe(null);
  //   } finally {
  //     await db.query(`DROP SPACE ALLOW NOT EMPTY ${spaceName}`);
  //   }
  // })

  it('CREATE MODEL', async () => {
    const [space, drop] = await getSpace(db, `${testSpace + Date.now()}`);
    const tableName = `${space}.testTable${Date.now()}`;

    try {
      await db.query(`CREATE MODEL ${tableName}(id: string, name: string)`);

      expect(
        await db.query(
          `CREATE MODEL IF NOT EXISTS ${tableName}(id: string, name: string)`,
        ),
      ).toBe(false);
    } finally {
      await drop();
    }
  });

  it('ALTER MODEL', async () => {
    const [tableName, drop] = await getTable(db);

    try {
      await db.query(`CREATE MODEL ${tableName}(id: string, name: string)`);
      await db.query(`ALTER MODEL ${tableName} ADD field { type: uint8 }`);
      await db.query(
        `ALTER MODEL ${tableName} ADD ( first_field { type: string }, second_field { type: binary } )`,
      );

      await db.query(`ALTER MODEL ${tableName} UPDATE field { type: uint64 }`);
      await db.query(
        `ALTER MODEL ${tableName} REMOVE (first_field, second_field)`,
      );
    } finally {
      await drop();
    }
  });
});
