import Database from 'better-sqlite3';
import { sfTypeToSqlite } from './type-map.js';

/** Definition of a SQLite table column derived from a Salesforce field. */
export type ColumnDef = {
  /** The column/field name. */
  name: string;
  /** The Salesforce field type (e.g. "string", "double", "boolean"), used to determine the SQLite column type. */
  sfType: string;
};

function quoteId(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function convertValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

export class BulkyardDatabase {
  private db: Database.Database;

  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = OFF');
  }

  public createTable(tableName: string, columns: ColumnDef[]): void {
    const quoted = quoteId(tableName);
    this.db.exec(`DROP TABLE IF EXISTS ${quoted}`);

    const colDefs = columns.map((c) => `${quoteId(c.name)} ${sfTypeToSqlite(c.sfType)}`).join(', ');
    this.db.exec(`CREATE TABLE ${quoted} (${colDefs})`);
  }

  public insertRecords(tableName: string, columns: string[], records: Array<Record<string, unknown>>): void {
    const quoted = quoteId(tableName);
    const colList = columns.map((c) => quoteId(c)).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = this.db.prepare(`INSERT INTO ${quoted} (${colList}) VALUES (${placeholders})`);

    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const insertBatch = this.db.transaction((rows: Array<Record<string, unknown>>) => {
        for (const row of rows) {
          const values = columns.map((col) => convertValue(row[col]));
          stmt.run(...values);
        }
      });
      insertBatch(batch);
    }
  }

  public readAllRows(tableName: string): Array<Record<string, unknown>> {
    const quoted = quoteId(tableName);
    return this.db.prepare(`SELECT * FROM ${quoted}`).all() as Array<Record<string, unknown>>;
  }

  public tableExists(tableName: string): boolean {
    const row = this.db
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name = ?")
      .get(tableName) as { cnt: number };
    return row.cnt > 0;
  }

  public getTableColumns(tableName: string): string[] {
    const rows = this.db.prepare(`PRAGMA table_info(${quoteId(tableName)})`).all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  public getRowCount(tableName: string): number {
    const row = this.db.prepare(`SELECT count(*) as cnt FROM ${quoteId(tableName)}`).get() as { cnt: number };
    return row.cnt;
  }

  public close(): void {
    this.db.close();
  }
}
