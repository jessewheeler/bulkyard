import { Connection } from '@salesforce/core';
import { BulkyardDatabase, ColumnDef } from './database.js';
import { BulkyardObjectConfig } from './config.js';

/** Result of extracting a single Salesforce object into SQLite. */
export type ExtractResult = {
  /** The Salesforce object API name that was extracted. */
  object: string;
  /** The SQLite table the records were written to. */
  table: string;
  /** Number of records extracted. */
  recordCount: number;
  /** Whether the extraction completed without errors. */
  success: boolean;
  /** Error message if the extraction failed. */
  error?: string;
};

export async function extractObject(
  conn: Connection,
  db: BulkyardDatabase,
  objConfig: BulkyardObjectConfig
): Promise<ExtractResult> {
  const tableName = objConfig.table ?? objConfig.object;
  try {
    const queryResult = await conn.bulk2.query(objConfig.query!);
    const records = await queryResult.toArray();

    if (records.length === 0) {
      return { object: objConfig.object, table: tableName, recordCount: 0, success: true };
    }

    const firstRecord = records[0] as Record<string, unknown>;
    const recordKeys = Object.keys(firstRecord).filter((k) => k !== 'attributes');

    const describeResult = await conn.describe(objConfig.object);
    const fieldMap = new Map(describeResult.fields.map((f) => [f.name, f.type]));

    const columns: ColumnDef[] = recordKeys.map((key) => ({
      name: key,
      sfType: fieldMap.get(key) ?? 'string',
    }));

    db.createTable(tableName, columns);

    const cleanRecords = records.map((rec) => {
      const cleaned: Record<string, unknown> = {};
      for (const key of recordKeys) {
        cleaned[key] = (rec as Record<string, unknown>)[key];
      }
      return cleaned;
    });

    db.insertRecords(tableName, recordKeys, cleanRecords);

    return { object: objConfig.object, table: tableName, recordCount: records.length, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { object: objConfig.object, table: tableName, recordCount: 0, success: false, error: message };
  }
}
