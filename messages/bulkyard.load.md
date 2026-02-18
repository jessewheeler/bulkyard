# summary

Load data from a local SQLite database into a Salesforce org using Bulk API 2.0.

# description

Reads a YAML config file to determine which tables to load, then uses Bulk API 2.0 to insert, update, or upsert records from a local SQLite database into the target Salesforce org.

Alternatively, use --sobject and --operation to load a single object without a config file.

# examples

- Load data using a config file:

  <%= config.bin %> <%= command.id %> --target-org myOrg --config-file bulkyard.config.yml

- Load a single object inline:

  <%= config.bin %> <%= command.id %> --target-org myOrg --sobject Account --operation upsert --external-id-field Id

- Load inline with a custom database and table name:

  <%= config.bin %> <%= command.id %> --target-org myOrg -s Account -p insert -d my.db -t Account_Staging

# flags.config-file.summary

Path to the YAML config file.

# flags.sobject.summary

Salesforce object API name (e.g. Account, Contact).

# flags.operation.summary

Bulk API operation: insert, update, upsert, or delete.

# flags.external-id-field.summary

External ID field for upsert operations.

# flags.database.summary

Path to the SQLite database file.

# flags.table.summary

SQLite table name override (defaults to the object name).

# info.loading

Loading %s...

# info.complete

Load complete.

# error.objectFailed

Failed to load %s: %s
