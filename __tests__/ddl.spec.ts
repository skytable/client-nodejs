import { getDBConfig, getSpace } from './utils';
import { QueryResult, SQParam } from '../src/skytable';

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

  // FIXME need to fix
  // it('ALTER SPACE', async () => {
  //   const spaceName = `${testSpace + Date.now()}`;
  //   try {
  //     const isNotCreated = await db.query(`CREATE SPACE IF NOT EXISTS ${spaceName}`);

  //     if (isNotCreated) {
  //       await db.query(`CREATE SPACE ${spaceName} WITH { property_name: ? }`, 1234);
  //     }

  //     expect(await db.query(`ALTER SPACE ${spaceName} WITH { property_name: ? }`, 456)).toBe(null);
  //   } finally {
  //     await db.query(`DROP SPACE ALLOW NOT EMPTY ${spaceName}`);
  //   }
  // })
});
