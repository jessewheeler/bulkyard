# summary

Generate an annotated bulkyard YAML config file.

# description

Scaffolds a starter config file with commented examples for both extract and load operations. The generated file includes an active Account extract example and a commented-out Contact load example, with annotations explaining every field.

# examples

- Generate a default bulkyard.config.yml config file:

  <%= config.bin %> <%= command.id %>

- Generate a config file at a custom path:

  <%= config.bin %> <%= command.id %> --output-file my-config.yml

- Overwrite an existing config file:

  <%= config.bin %> <%= command.id %> --force

# flags.output-file.summary

Path to write the generated config file.

# flags.force.summary

Overwrite the output file if it already exists.

# info.created

Created config file: %s

# error.alreadyExists

File already exists: %s. Use --force to overwrite.
