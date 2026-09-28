const { Client } = require('pg');
const tries = [
  ['postgres://padosipro:padosipro@localhost:5432/padosipro', 'padosipro/padosipro'],
  ['postgres://postgres:postgres@localhost:5432/postgres', 'postgres/postgres'],
  ['postgres://postgres:postgres@localhost:5432/padosipro', 'postgres/postgres'],
];
(async () => {
  for (const [url, label] of tries) {
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 4000 });
    try {
      await c.connect();
      const r = await c.query('select current_user, current_database(), version()');
      console.log('OK', label, r.rows[0].current_user, r.rows[0].current_database);
      console.log('   ', r.rows[0].version.split(',')[0]);
      await c.end();
    } catch (e) {
      console.log('FAIL', label, e.message.split('\n')[0]);
    }
  }
})();
