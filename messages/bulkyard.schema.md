# summary

Cache Salesforce object schemas into a local SQLite database.

# description

Describes one or more Salesforce objects and caches their field metadata into a local SQLite database. Cached schemas allow `bulkyard extract` to expand `SELECT *` queries without making a live describe call.

Provide object names via `--sobjects` (comma-separated) or read them from a `--config-file`.

# examples

- Cache schemas for specific objects:

  <%= config.bin %> <%= command.id %> --target-org myOrg --sobjects Account,Contact

- Cache schemas for all objects in a config file:

  <%= config.bin %> <%= command.id %> --target-org myOrg --config-file bulkyard.config.yml

# flags.sobjects.summary

Comma-separated list of Salesforce object API names to describe.

# flags.config-file.summary

Path to the YAML config file (reads object names from it).

# flags.database.summary

Path to the SQLite database file.

# info.describing

Describing %s...

# info.complete

Schema caching complete.
