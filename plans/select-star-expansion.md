# Plan: SELECT \* Expansion and Schema Command

## Context

Salesforce Bulk API 2.0 does not support `SELECT *` in SOQL. Users currently must enumerate every field explicitly. This change lets users write `SELECT * FROM Account WHERE ...` and have bulkyard expand `*` into all queryable field names before submitting the query. A new `sf bulkyard schema` command caches object metadata into the SQLite database so repeated extracts skip the live `conn.describe()` call.

## Development Approach: TDD

Each phase follows red-green-refactor. Write tests first, verify they fail, then implement until they pass.

## Phase 1: Core Schema Module

**1a. Write tests first: `test/core/schema.test.ts`**

Test cases for each function before any implementation:

- `containsSelectStar`: true for `SELECT * FROM Account`, `select * from Account WHERE ...`; false for `SELECT Id FROM Account`
- `extractObjectName`: returns `Account` from `SELECT * FROM Account WHERE ...`; throws on malformed query
- `getQueryableFields`: excludes fields with type `address` or `location`
- `expandSelectStar`: replaces `*` with field names, preserves WHERE/ORDER BY/LIMIT
- `describeToFieldInfos`: maps describe fields to `CachedFieldInfo[]`

**1b. Write tests: `test/core/database.test.ts`** (extend existing)

- `createSchemaTable` creates the table
- `writeSchema` + `readSchema` round-trip
- `readSchema` returns null for uncached objects
- `writeSchema` replaces existing rows on re-write

**1c. Implement `src/core/schema.ts`** — make tests green

**1d. Implement schema methods in `src/core/database.ts`** — make tests green

**Create `src/core/schema.ts`**

Types:

- `CachedFieldInfo` — `{ name: string; type: string }` (minimal per-field metadata)

Functions:

- `containsSelectStar(query: string): boolean` — regex test for `SELECT * FROM`
- `extractObjectName(query: string): string` — extracts object name from `FROM <object>`
- `getQueryableFields(fields: CachedFieldInfo[]): CachedFieldInfo[]` — filters out compound types (`address`, `location`)
- `expandSelectStar(query: string, fields: CachedFieldInfo[]): string` — replaces `SELECT * FROM` with `SELECT field1, field2, ... FROM`, preserving WHERE/ORDER BY/LIMIT
- `describeToFieldInfos(describeResult): CachedFieldInfo[]` — maps describe fields to cache format

Schema cache stored in SQLite via `BulkyardDatabase`:

- `readSchemaCache(db: BulkyardDatabase, objectName: string): CachedFieldInfo[] | null`
- `writeSchemaCache(db: BulkyardDatabase, objectName: string, fields: CachedFieldInfo[]): void`

The cache table `_bulkyard_schema` has columns: `object_name TEXT`, `field_name TEXT`, `field_type TEXT`. The underscore prefix distinguishes it from data tables. `writeSchemaCache` drops-and-recreates rows for the given object (upsert-by-delete pattern matching `createTable`).

## Phase 2: Schema Command

**2a. Write tests first: `test/commands/bulkyard/schema.test.ts`**

- Command metadata: summary, description, examples defined
- Flag definitions: `--sobjects`, `--config-file`, `--database`, `--target-org`
- Run logic: stubs `conn.describe()`, verifies `writeSchema` is called for each object

**2b. Implement `src/commands/bulkyard/schema.ts`** — make tests green

**Create `src/commands/bulkyard/schema.ts`**

```
sf bulkyard schema --target-org myOrg --sobjects Account,Contact
sf bulkyard schema --target-org myOrg --config-file bulkyard.config.yml
```

Flags:

- `--target-org` (required) — org to describe
- `--api-version` (optional)
- `--sobjects` (string) — comma-separated list of object API names; `exactlyOne` with `--config-file`
- `--config-file` (file) — reads object names from existing bulkyard YAML config
- `--database` (string, default `bulkyard.db`) — SQLite database to write schema cache to; `exclusive` with `--config-file` (config file provides its own database path)

Logic:

1. Determine object list from `--sobjects` (split on comma, trim) or config file
2. Open SQLite database
3. For each object, call `conn.describe(objectName)`
4. Map to `CachedFieldInfo[]` via `describeToFieldInfos()`
5. Write to `_bulkyard_schema` table via `writeSchemaCache()`
6. Log summary table: object name, field count

Return type: `{ database: string; objects: string[] }`

**Create `messages/bulkyard.schema.md`** — command messages

**Create `test/commands/bulkyard/schema.test.ts`** — command tests

## Phase 3: Extract Integration

**3a. Write tests first: extend `test/core/extractor.test.ts`**

- `extractObject` with `SELECT * FROM Account` expands to explicit fields (verify `requestPost` stub receives expanded query)
- When `_bulkyard_schema` has cached fields, no `conn.describe()` call is made
- When cache miss, falls back to `conn.describe()`
- Compound fields excluded from expansion
- Return value indicates whether live describe was used

**3b. Write tests first: extend `test/commands/bulkyard/extract.test.ts`**

- After SELECT \* with cache miss, `confirm` prompt is called
- If user confirms, `writeSchema` is called
- If user declines, no schema written

**3c. Implement changes** — make tests green

**Modify `src/core/extractor.ts`**

Add a `resolveQuery` function (or inline in `extractObject`) that handles SELECT \* expansion:

1. If `containsSelectStar(query)` is true:
   - Try loading fields from `_bulkyard_schema` table for `objConfig.object`
   - If cache miss, fall back to `conn.describe()` and convert via `describeToFieldInfos()`
   - Call `expandSelectStar(query, getQueryableFields(fields))` to get the expanded query
   - Reuse the resolved fields for the `fieldMap` (avoid redundant describe call)
   - Return a flag indicating the schema was fetched live (not from cache)
2. If query does NOT contain `SELECT *`: existing flow unchanged

**Modify `src/core/database.ts`**

Add methods to support the schema cache table:

- `createSchemaTable(): void` — creates `_bulkyard_schema` if not exists
- `readSchema(objectName: string): Array<{ field_name: string; field_type: string }> | null` — returns rows or null if none
- `writeSchema(objectName: string, fields: Array<{ field_name: string; field_type: string }>): void` — deletes existing rows for object, inserts new ones

**Modify `src/commands/bulkyard/extract.ts`**

After a successful SELECT \* extraction where the schema was fetched live (not from cache), prompt the user:

```
Schema for "Account" was fetched from the org. Save it locally for future extractions? (y/N)
```

Uses `this.confirm({ message, defaultAnswer: false })` from `SfCommand`. If confirmed, calls `writeSchemaCache()` to persist to `_bulkyard_schema`. This keeps the extractor pure (no I/O prompts) and puts the interactive logic in the command layer where it belongs.

To support this, `extractObject` returns additional metadata indicating which objects had a live describe (cache miss) so the command can prompt accordingly.

**Modify `messages/bulkyard.extract.md`** — add SELECT \* example and confirm prompt message

**Update `test/core/extractor.test.ts`** — test SELECT \* expansion, cache hit/miss, compound field exclusion

## Files Summary

| Action | File                                                                        |
| ------ | --------------------------------------------------------------------------- |
| Create | `src/core/schema.ts`                                                        |
| Create | `src/commands/bulkyard/schema.ts`                                           |
| Create | `messages/bulkyard.schema.md`                                               |
| Create | `test/core/schema.test.ts`                                                  |
| Create | `test/commands/bulkyard/schema.test.ts`                                     |
| Modify | `src/core/database.ts` — add schema table methods                           |
| Modify | `src/core/extractor.ts` — SELECT \* expansion before Bulk API job           |
| Modify | `src/commands/bulkyard/extract.ts` — prompt to persist schema on cache miss |
| Modify | `messages/bulkyard.extract.md` — SELECT \* example, confirm prompt message  |
| Modify | `test/core/extractor.test.ts` — SELECT \* expansion tests                   |
| Modify | `test/core/database.test.ts` — schema table method tests                    |

## Verification

1. `yarn test:only` — all existing and new unit tests pass
2. `yarn compile` — TypeScript compiles cleanly
3. `yarn lint` — no lint errors
4. Manual: `sf bulkyard schema -o myOrg --sobjects Account,Contact` populates `_bulkyard_schema` in `bulkyard.db`
5. Manual: `sf bulkyard extract -o myOrg -s Account -q "SELECT * FROM Account"` expands and extracts all queryable fields
