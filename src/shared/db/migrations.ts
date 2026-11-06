import { DB } from '@op-engineering/op-sqlite';
import {
  ALTER_PAGES_ADD_HEIGHT_SQL,
  ALTER_PAGES_ADD_OCR_BLOCKS_SQL,
  ALTER_PAGES_ADD_WIDTH_SQL,
  CREATE_DOCUMENTS_TABLE_SQL,
  CREATE_MIGRATIONS_TABLE_SQL,
  CREATE_PAGES_DOCUMENT_INDEX_SQL,
  CREATE_PAGES_FTS_FALLBACK_TABLE_SQL,
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

  db.execute(CREATE_DOCUMENTS_TABLE_SQL);
  db.execute(CREATE_PAGES_TABLE_SQL);
  db.execute(CREATE_PAGES_DOCUMENT_INDEX_SQL);

  try {
    db.execute(CREATE_PAGES_FTS_TABLE_SQL);
  } catch (ftsError) {
    console.warn('[DB] FTS5 not available, creating fallback table:', ftsError);
    try {
      db.execute(CREATE_PAGES_FTS_FALLBACK_TABLE_SQL);
    } catch (fallbackError) {
      console.warn('[DB] Fallback pages_fts table notice:', fallbackError);
    }
  }

  try {
    const tableInfo = db.execute('PRAGMA table_info(pages);');
    const columns = new Set(
      ((tableInfo.rows?._array ?? []) as Array<{ name: string }>).map(
        r => r.name,
      ),
    );
    if (!columns.has('ocr_blocks_json')) {
      db.execute(ALTER_PAGES_ADD_OCR_BLOCKS_SQL);
    }
    if (!columns.has('width')) {
      db.execute(ALTER_PAGES_ADD_WIDTH_SQL);
    }
    if (!columns.has('height')) {
      db.execute(ALTER_PAGES_ADD_HEIGHT_SQL);
    }
  } catch (colError) {
    console.warn('[DB] Column check/alter warning:', colError);
  }

  try {
    const appliedResult = db.execute(
      'SELECT version FROM schema_migrations ORDER BY version ASC;',
    );
    const appliedRows = (appliedResult.rows?._array ?? []) as Array<{
      version: number;
    }>;
    const appliedVersions = new Set<number>(
      appliedRows.map(row => Number(row.version)),
    );

    for (const v of [1, 2]) {
      if (!appliedVersions.has(v)) {
        db.execute(
          'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?);',
          [v, Date.now()],
        );
      }
    }
  } catch (migError) {
    console.warn('[DB] schema_migrations update warning:', migError);
  }
};

