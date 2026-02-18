# bulkyard

A Salesforce CLI plugin for bulk data extraction and loading via local SQLite3 databases.

Uses the Bulk API 2.0 to move data between a Salesforce org and a local SQLite database. A YAML config file drives which objects to process, enabling repeatable multi-object operations.

## Install

```bash
sf plugins install bulkyard@x.y.z
```

## Config File

Create a `bulkyard.config.yml` file to define your database path and the objects to extract or load:

```yaml
database: ./bulkyard.db

objects:
  - object: Account
    query: 'SELECT Id, Name, Industry FROM Account WHERE Industry != null'
    operation: upsert
    externalIdField: Id

  - object: Contact
    query: 'SELECT Id, FirstName, LastName, Email FROM Contact'
    operation: insert
    table: Contact_Staging
```

| Field             | Used By | Description                                                |
| ----------------- | ------- | ---------------------------------------------------------- |
| `object`          | both    | Salesforce object API name                                 |
| `query`           | extract | SOQL query to execute                                      |
| `operation`       | load    | Bulk API operation: `insert`, `update`, `upsert`, `delete` |
| `externalIdField` | load    | Required when operation is `upsert`                        |
| `table`           | both    | Optional SQLite table name override (defaults to `object`) |

## Commands

### `sf bulkyard extract`

Extract data from a Salesforce org into a local SQLite database using Bulk API 2.0.

```
USAGE
  $ sf bulkyard extract -o <value> (-c <value> | -s <value>) [--json] [--api-version <value>]
    [-q <value>] [-d <value>] [-t <value>]

FLAGS
  -c, --config-file=<value>  Path to the YAML config file.
  -s, --sobject=<value>      Salesforce object API name (e.g. Account, Contact).
  -q, --query=<value>        SOQL query to execute for extraction.
  -d, --database=<value>     [default: bulkyard.db] Path to the SQLite database file.
  -t, --table=<value>        SQLite table name override (defaults to the object name).
  -o, --target-org=<value>   (required) Username or alias of the target org.
      --api-version=<value>  Override the API version used for requests.

EXAMPLES
  Multi-object mode (config file):
  $ sf bulkyard extract --target-org myOrg --config-file bulkyard.config.yml

  Single-object mode (inline flags):
  $ sf bulkyard extract --target-org myOrg --sobject Account --query "SELECT Id, Name FROM Account"

  Inline with custom database and table:
  $ sf bulkyard extract -o myOrg -s Account -q "SELECT Id, Name FROM Account" -d my.db -t Account_Backup
```

For each object in the config, this command:

1. Runs the SOQL query via Bulk API 2.0
2. Describes the object to map Salesforce field types to SQLite column types
3. Creates (or replaces) a SQLite table with typed columns
4. Inserts all records in transactional batches of 1,000 rows

### `sf bulkyard load`

Load data from a local SQLite database into a Salesforce org using Bulk API 2.0.

```
USAGE
  $ sf bulkyard load -o <value> (-c <value> | -s <value>) [--json] [--api-version <value>]
    [-p <value>] [-e <value>] [-d <value>] [-t <value>]

FLAGS
  -c, --config-file=<value>       Path to the YAML config file.
  -s, --sobject=<value>           Salesforce object API name (e.g. Account, Contact).
  -p, --operation=<value>         Bulk API operation: insert, update, upsert, or delete.
  -e, --external-id-field=<value> External ID field for upsert operations.
  -d, --database=<value>          [default: bulkyard.db] Path to the SQLite database file.
  -t, --table=<value>             SQLite table name override (defaults to the object name).
  -o, --target-org=<value>        (required) Username or alias of the target org.
      --api-version=<value>       Override the API version used for requests.

EXAMPLES
  Multi-object mode (config file):
  $ sf bulkyard load --target-org myOrg --config-file bulkyard.config.yml

  Single-object mode (inline flags):
  $ sf bulkyard load --target-org myOrg --sobject Account --operation upsert --external-id-field Id

  Inline with custom database and table:
  $ sf bulkyard load -o myOrg -s Account -p insert -d my.db -t Account_Staging
```

For each object in the config, this command:

1. Reads all rows from the corresponding SQLite table
2. Submits them to the Salesforce Bulk API 2.0 using the configured operation
3. Reports success/failure counts per object

## License

BSD-3-Clause. See [LICENSE](LICENSE).

## Development

```bash
# Install dependencies
yarn

# Build
yarn build

# Run locally
./bin/dev.js bulkyard extract --help
./bin/dev.js bulkyard load --help

# Run tests
yarn test:only

# Lint
yarn lint
```
