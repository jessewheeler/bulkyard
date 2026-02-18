import { readFileSync } from 'node:fs';
import { SfError } from '@salesforce/core';
import yaml from 'js-yaml';

/** Configuration for a single Salesforce object to extract or load. */
export type BulkyardObjectConfig = {
  /** The Salesforce object API name (e.g. "Account", "Contact"). */
  object: string;
  /** SOQL query used to extract records. Required for extract operations. */
  query?: string;
  /** Bulk API operation type for load (e.g. "insert", "update", "upsert", "delete"). */
  operation?: string;
  /** External ID field name, required when {@link operation} is "upsert". */
  externalIdField?: string;
  /** SQLite table name override. Defaults to the object API name. */
  table?: string;
};

/** Top-level bulkyard configuration, typically loaded from a YAML config file. */
export type BulkyardConfig = {
  /** File path to the SQLite database. */
  database: string;
  /** One or more Salesforce object configurations to process. */
  objects: BulkyardObjectConfig[];
};

export function loadConfig(filePath: string): BulkyardConfig {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = yaml.load(raw) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw new SfError(`Invalid config file: ${filePath}`);
  }

  if (typeof parsed.database !== 'string' || parsed.database.length === 0) {
    throw new SfError('Config must include a "database" path string.');
  }

  if (!Array.isArray(parsed.objects) || parsed.objects.length === 0) {
    throw new SfError('Config must include a non-empty "objects" array.');
  }

  for (const obj of parsed.objects as Array<Record<string, unknown>>) {
    if (typeof obj.object !== 'string' || obj.object.length === 0) {
      throw new SfError('Each object entry must have an "object" field.');
    }
  }

  return parsed as unknown as BulkyardConfig;
}

/** Inline flag values passed directly on the CLI instead of via a config file. */
export type InlineFlagConfig = {
  /** The Salesforce object API name. */
  sobject: string;
  /** File path to the SQLite database. */
  database: string;
  /** SOQL query for extract operations. */
  query?: string;
  /** Bulk API operation type for load operations. */
  operation?: string;
  /** External ID field name for upsert operations. */
  externalIdField?: string;
  /** SQLite table name override. */
  table?: string;
};

export function buildConfigFromFlags(flags: InlineFlagConfig): BulkyardConfig {
  const obj: BulkyardObjectConfig = { object: flags.sobject };
  if (flags.query) obj.query = flags.query;
  if (flags.operation) obj.operation = flags.operation;
  if (flags.externalIdField) obj.externalIdField = flags.externalIdField;
  if (flags.table) obj.table = flags.table;

  return { database: flags.database, objects: [obj] };
}

export function validateForExtract(config: BulkyardConfig): void {
  for (const obj of config.objects) {
    if (!obj.query) {
      throw new SfError(`Object "${obj.object}" is missing a "query" for extract.`);
    }
  }
}

export function validateForLoad(config: BulkyardConfig): void {
  for (const obj of config.objects) {
    if (!obj.operation) {
      throw new SfError(`Object "${obj.object}" is missing an "operation" for load.`);
    }
    if (obj.operation === 'upsert' && !obj.externalIdField) {
      throw new SfError(`Object "${obj.object}" uses upsert but is missing "externalIdField".`);
    }
  }
}
