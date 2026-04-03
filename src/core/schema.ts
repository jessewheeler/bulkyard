/** Minimal per-field metadata stored in the schema cache. */
export type CachedFieldInfo = {
  /** The field API name. */
  name: string;
  /** The Salesforce field type (e.g. "string", "id", "boolean"). */
  type: string;
};

const SELECT_STAR_RE = /\bSELECT\s+\*\s+FROM\b/i;
const FROM_OBJECT_RE = /\bFROM\s+(\w+)/i;

/** Compound field types that cannot be queried directly in SOQL. */
const COMPOUND_TYPES = new Set(['address', 'location']);

/** Returns true if the query contains `SELECT * FROM`. */
export function containsSelectStar(query: string): boolean {
  return SELECT_STAR_RE.test(query);
}

/** Extracts the object name from the `FROM <object>` clause of a SOQL query. */
export function extractObjectName(query: string): string {
  const match = FROM_OBJECT_RE.exec(query);
  if (!match) {
    throw new Error(`Unable to extract object name from query: ${query}`);
  }
  return match[1];
}

/** Filters out compound field types that cannot be queried directly. */
export function getQueryableFields(fields: CachedFieldInfo[]): CachedFieldInfo[] {
  return fields.filter((f) => !COMPOUND_TYPES.has(f.type));
}

/** Replaces `SELECT * FROM` with an explicit field list, preserving the rest of the query. */
export function expandSelectStar(query: string, fields: CachedFieldInfo[]): string {
  const fieldList = fields.map((f) => f.name).join(', ');
  return query.replace(SELECT_STAR_RE, `SELECT ${fieldList} FROM`);
}

/** Maps a Salesforce describe result's fields array to CachedFieldInfo[]. */
export function describeToFieldInfos(describeResult: {
  fields: Array<{ name: string; type: string }>;
}): CachedFieldInfo[] {
  return describeResult.fields.map((f) => ({ name: f.name, type: f.type }));
}
