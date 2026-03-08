import { Connection } from '@salesforce/core';
import { parse } from 'csv-parse/sync';
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

const BATCH_SIZE = 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 600_000;

type QueryJobState = 'UploadComplete' | 'InProgress' | 'Aborted' | 'JobComplete' | 'Failed';
type QueryJobInfo = { id: string; state: QueryJobState; errorMessage?: string };

// Recursive rather than looping to satisfy no-constant-condition and no-await-in-loop.
async function waitForJobCompletion(conn: Connection, jobId: string, deadline: number): Promise<void> {
  if (Date.now() > deadline) {
    throw new Error(`Bulk query job timed out after ${POLL_TIMEOUT_MS / 1000}s`);
  }
  const jobUrl = `${conn.instanceUrl}/services/data/v${conn.getApiVersion()}/jobs/query/${jobId}`;
  const info = await conn.requestGet<QueryJobInfo>(jobUrl);
  if (info.state === 'JobComplete') return;
  if (info.state === 'Failed' || info.state === 'Aborted') {
    const detail = info.errorMessage ? `: ${info.errorMessage}` : '';
    throw new Error(`Bulk query job ${info.state}${detail}`);
  }
  await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  return waitForJobCompletion(conn, jobId, deadline);
}

function parseCsvPage(csvText: string): Array<Record<string, unknown>> {
  // csv-parse uses snake_case option names
  // eslint-disable-next-line camelcase
  return parse(csvText, { columns: true, skip_empty_lines: true, cast: (v: string) => (v === '' ? null : v) }) as Array<
    Record<string, unknown>
  >;
}

export async function extractObject(
  conn: Connection,
  db: BulkyardDatabase,
  objConfig: BulkyardObjectConfig
): Promise<ExtractResult> {
  const tableName = objConfig.table ?? objConfig.object;
  try {
    const apiVersion = conn.getApiVersion();
    const jobsUrl = `${conn.instanceUrl}/services/data/v${apiVersion}/jobs/query`;

    const describeResult = await conn.describe(objConfig.object);
    const fieldMap = new Map(describeResult.fields.map((f) => [f.name, f.type]));

    // Create the bulk query job
    const jobInfo = await conn.requestPost<QueryJobInfo>(jobsUrl, {
      operation: 'query',
      query: objConfig.query,
    });

    // Poll until the job is complete
    await waitForJobCompletion(conn, jobInfo.id, Date.now() + POLL_TIMEOUT_MS);

    // Fetch result pages one at a time using the Sforce-Locator header.
    // Using fetch directly (rather than conn.bulk2.query's streaming abstraction) because
    // jsforce's QueryJobV2.result() pipes multiple locator pages to the same stream with
    // {end: true}, closing it after the first page and silently dropping subsequent pages.
    const resultsBaseUrl = `${jobsUrl}/${jobInfo.id}/results`;
    const authHeaders = {
      Authorization: `Bearer ${conn.accessToken!}`,
      Accept: 'text/csv',
    };

    let locator: string | null = null;
    let recordKeys: string[] | null = null;
    let buffer: Array<Record<string, unknown>> = [];
    let totalCount = 0;

    do {
      const url = locator ? `${resultsBaseUrl}?locator=${encodeURIComponent(locator)}` : resultsBaseUrl;
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url, { headers: authHeaders });

      if (!response.ok) {
        // eslint-disable-next-line no-await-in-loop
        const body = await response.text();
        throw new Error(`Failed to fetch results page (${response.status}): ${body}`);
      }

      locator = response.headers.get('sforce-locator');
      // eslint-disable-next-line no-await-in-loop
      const csvText = await response.text();

      if (!csvText.trim()) continue;

      const rows = parseCsvPage(csvText);

      for (const row of rows) {
        if (recordKeys === null) {
          recordKeys = Object.keys(row);
          const columns: ColumnDef[] = recordKeys.map((key) => ({
            name: key,
            sfType: fieldMap.get(key) ?? 'string',
          }));
          db.createTable(tableName, columns);
        }

        buffer.push(row);
        totalCount++;

        if (buffer.length >= BATCH_SIZE) {
          db.insertRecords(tableName, recordKeys, buffer);
          buffer = [];
        }
      }
    } while (locator && locator !== 'null');

    if (buffer.length > 0 && recordKeys !== null) {
      db.insertRecords(tableName, recordKeys, buffer);
    }

    return { object: objConfig.object, table: tableName, recordCount: totalCount, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { object: objConfig.object, table: tableName, recordCount: 0, success: false, error: message };
  }
}
