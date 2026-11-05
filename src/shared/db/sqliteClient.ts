import {DB, open, QueryResult} from '@op-engineering/op-sqlite';
import {runDatabaseMigrations} from './migrations';
import {DB_NAME} from './schema';

export type SqlParamValue = string | number | boolean | null;

class SqliteClient {
  private instance: DB | null = null;
  private isInitialized = false;

  public getDatabase(): DB {
    if (!this.instance) {
      this.instance = open({name: DB_NAME});
    }
    return this.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    const db = this.getDatabase();
    await runDatabaseMigrations(db);
    this.isInitialized = true;
  }

  public execute(sql: string, params: SqlParamValue[] = []): QueryResult {
    const db = this.getDatabase();
    return db.execute(sql, params);
  }

  public async executeAsync(
    sql: string,
    params: SqlParamValue[] = [],
  ): Promise<QueryResult> {
    const db = this.getDatabase();
    return db.executeAsync(sql, params);
  }

  public async queryRows<T>(
    sql: string,
    params: SqlParamValue[] = [],
  ): Promise<T[]> {
    const result = await this.executeAsync(sql, params);
    return (result.rows?._array ?? []) as T[];
  }

  public close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
      this.isInitialized = false;
    }
  }
}

export const sqliteClient = new SqliteClient();

