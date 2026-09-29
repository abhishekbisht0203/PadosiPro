/**
 * Boots a throwaway Postgres so `npm run test:embedded` works on a machine
 * without Docker. The data directory lives in the OS temp folder and is deleted
 * on shutdown, so nothing is left behind and nothing else on the machine is
 * touched.
 *
 * Reviewers who have Docker should prefer `npm test` against the compose stack;
 * this exists so the suite is never blocked by a missing daemon.
 */
import EmbeddedPostgres from 'embedded-postgres';

const PORT = Number(process.env.EMBEDDED_PG_PORT ?? 55432);

export async function startEmbeddedPostgres(): Promise<{ stop: () => Promise<void> }> {
  const pg = new EmbeddedPostgres({
    databaseDir: `${process.env.TEMP ?? '.'}\\padosipro-embedded-pg`,
    user: 'padosipro',
    password: 'padosipro',
    port: PORT,
    persistent: false,
  });

  await pg.initialise().catch((err: Error) => {
    // `initialise` fails when a previous run left a directory behind; that is
    // recoverable, and `start` is what actually matters.
    if (!/already exists|EEXIST/i.test(err.message)) throw err;
  });
  await pg.start();
  await pg.createDatabase('padosipro_test');

  return {
    stop: async () => {
      await pg.stop().catch(() => undefined);
    },
  };
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('embedded-pg.ts');

if (isDirectRun) {
  // Intentionally not awaited: this keeps the process alive for the embedded
  // server, and the `void` marks the floating promise as deliberate.
  void startEmbeddedPostgres()
    .then(async (instance) => {
      console.info(`[embedded-pg] running on localhost:${PORT}/padosipro_test — press Ctrl+C to stop`);
      process.on('SIGINT', () => {
        void instance.stop().finally(() => process.exit(0));
      });
    })
    .catch((err) => {
      console.error('[embedded-pg] failed to start:', err);
      process.exit(1);
    });
}
