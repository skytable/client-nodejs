const { Config, Query } = require('skytable-node');
const cfg = new Config('root', 'password');

async function main() {
  let db;
  try {
    db = await cfg.connect();
    console.log(await db.query(new Query('sysctl report status')));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    if (db) {
      await db.disconnect();
    }
  }
}

main();
