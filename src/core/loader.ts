import { Connection } from '@salesforce/core';
import { BulkyardDatabase } from './database.js';
import { BulkyardObjectConfig } from './config.js';

/** Result of loading records from SQLite into a Salesforce object via Bulk API 2.0. */
export type LoadResult = {
  /** The Salesforce object API name that was loaded. */
  object: string;
  /** The SQLite table the records were read from. */
  table: string;
  /** Total number of records submitted. */
  totalRecords: number;
  /** Number of records that were successfully loaded. */
  successCount: number;
  /** Number of records that failed to load. */
  failureCount: number;
  /** Whether all records were loaded without failures. */
  success: boolean;
  /** List of error messages from failed records. */
  errors: string[];
};

export async function loadObject(
  conn: Connection,
  db: BulkyardDatabase,
  objConfig: BulkyardObjectConfig
): Promise<LoadResult> {
  const tableName = objConfig.table ?? objConfig.object;
  try {
    if (!db.tableExists(tableName)) {
      return {
        object: objConfig.object,
        table: tableName,
        totalRecords: 0,
        successCount: 0,
        failureCount: 0,
        success: false,
        errors: [`Table "${tableName}" does not exist in the database.`],
      };
    }

    const rows = db.readAllRows(tableName);
    if (rows.length === 0) {
      return {
        object: objConfig.object,
        table: tableName,
        totalRecords: 0,
        successCount: 0,
        failureCount: 0,
        success: true,
        errors: [],
      };
    }

    const bulkResult = await conn.bulk2.loadAndWaitForResults({
      object: objConfig.object,
      operation: objConfig.operation as 'insert' | 'update' | 'upsert' | 'delete',
      input: rows as Array<Record<string, string>>,
      ...(objConfig.externalIdField ? { externalIdFieldName: objConfig.externalIdField } : {}),
    });

    const successCount = bulkResult.successfulResults.length;
    const failureCount = bulkResult.failedResults.length;
    const errors = bulkResult.failedResults.map((f) => `${f.sf__Id ?? 'unknown'}: ${f.sf__Error ?? 'unknown error'}`);

    return {
      object: objConfig.object,
      table: tableName,
      totalRecords: rows.length,
      successCount,
      failureCount,
      success: failureCount === 0,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      object: objConfig.object,
      table: tableName,
      totalRecords: 0,
      successCount: 0,
      failureCount: 0,
      success: false,
      errors: [message],
    };
  }
}
