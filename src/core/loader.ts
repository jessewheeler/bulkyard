import { Connection } from '@salesforce/core';
import { BulkyardDatabase } from './database.js';
import { BulkyardObjectConfig } from './config.js';

export type LoadResult = {
  object: string;
  table: string;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  success: boolean;
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
