# summary

Extract data from a Salesforce org into a local SQLite database using Bulk API 2.0.

# description

Reads a YAML config file to determine which objects to query, then uses Bulk API 2.0 to extract records and write them to a local SQLite database. Each object is stored in its own table.

Alternatively, use --sobject and --query to extract a single object without a config file.

# examples

- Extract data using a config file:

  <%= config.bin %> <%= command.id %> --target-org myOrg --config-file bulkyard.config.yml

- Extract a single object inline:

  <%= config.bin %> <%= command.id %> --target-org myOrg --sobject Account --query "SELECT Id, Name FROM Account"

- Extract inline with a custom database and table name:

  <%= config.bin %> <%= command.id %> --target-org myOrg -s Account -q "SELECT Id, Name FROM Account" -d my.db -t Account_Backup

# flags.config-file.summary

Path to the YAML config file.

# flags.sobject.summary

Salesforce object API name (e.g. Account, Contact).

# flags.query.summary

SOQL query to execute for extraction.

# flags.database.summary

Path to the SQLite database file.

# flags.table.summary

SQLite table name override (defaults to the object name).

# info.extracting

Extracting %s...

# info.complete

Extraction complete.

# error.objectFailed

Failed to extract %s: %s
