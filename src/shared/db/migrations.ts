import {DB} from '@op-engineering/op-sqlite';
import {
  ALTER_PAGES_ADD_HEIGHT_SQL,
  ALTER_PAGES_ADD_OCR_BLOCKS_SQL,
  ALTER_PAGES_ADD_WIDTH_SQL,
  CREATE_DOCUMENTS_TABLE_SQL,
  CREATE_MIGRATIONS_TABLE_SQL,
  CREATE_PAGES_DOCUMENT_INDEX_SQL,
  CREATE_PAGES_FTS_TABLE_SQL,
  CREATE_PAGES_TABLE_SQL,
} from './schema';

export interface MigrationStep {
  version: number;
  statements: string[];
}

export const MIGRATIONS: readonly MigrationStep[] = [
  {
    version: 1,
    statements: [
      CREATE_DOCUMENTS_TABLE_SQL,
      CREATE_PAGES_TABLE_SQL,
      CREATE_PAGES_DOCUMENT_INDEX_SQL,
      CREATE_PAGES_FTS_TABLE_SQL,
    ],
  },
  {
    version: 2,
    statements: [
      ALTER_PAGES_ADD_OCR_BLOCKS_SQL,
      ALTER_PAGES_ADD_WIDTH_SQL,
      ALTER_PAGES_ADD_HEIGHT_SQL,
    ],
  },
];

export const runDatabaseMigrations = async (db: DB): Promise<void> => {
  db.execute('PRAGMA foreign_keys = ON;');
  db.execute(CREATE_MIGRATIONS_TABLE_SQL);

  const appliedResult = db.execute(
    'SELECT version FROM schema_migrations ORDER BY version ASC;',
  );
  const appliedRows = (appliedResult.rows?._array ?? []) as Array<{
    version: number;
  }>;
  const appliedVersions = new Set<number>(
    appliedRows.map(row => Number(row.version)),
  );

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    await db.transaction(async tx => {
      for (const sql of migration.statements) {
        await tx.executeAsync(sql);
      }
      await tx.executeAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);',
        [migration.version, Date.now()],
      );
    });
  }
};

