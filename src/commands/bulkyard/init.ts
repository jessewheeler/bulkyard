import { existsSync, writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('bulkyard', 'bulkyard.init');

/** Return type for the `bulkyard init` command. */
export type InitCommandResult = { outputFile: string };

const TEMPLATE = `# bulkyard config file
# See: https://github.com/jessegarrido/bulkyard

# Path to the SQLite database file used for extract and load operations.
database: bulkyard.db

# List of Salesforce objects to process.
objects:
  # --- Extract example ---
  # Extracts Account records into the "Account" table in the database.
  - object: Account
    query: SELECT Id, Name, Industry FROM Account

  # --- Load example (commented out) ---
  # Upserts Contact records from the "Contact" table back into Salesforce.
  # - object: Contact
  #   operation: upsert
  #   externalIdField: Id

  # Each object entry supports the following fields:
  #   object          (required) Salesforce object API name (e.g. Account, Contact)
  #   query           (extract)  SOQL query to execute
  #   operation       (load)     Bulk API operation: insert, update, upsert, or delete
  #   externalIdField (load)     External ID field, required for upsert
  #   table           (optional) SQLite table name override (defaults to the object name)
`;

export default class Init extends SfCommand<InitCommandResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'output-file': Flags.string({
      char: 'o',
      summary: messages.getMessage('flags.output-file.summary'),
      default: 'bulkyard.config.yml',
    }),
    force: Flags.boolean({
      char: 'f',
      summary: messages.getMessage('flags.force.summary'),
      default: false,
    }),
  };

  public async run(): Promise<InitCommandResult> {
    const { flags } = await this.parse(Init);
    const outputFile = flags['output-file'];

    if (existsSync(outputFile) && !flags.force) {
      throw new SfError(messages.getMessage('error.alreadyExists', [outputFile]), 'AlreadyExistsError', [
        'Use --force to overwrite the existing file.',
      ]);
    }

    writeFileSync(outputFile, TEMPLATE, 'utf8');
    this.log(messages.getMessage('info.created', [outputFile]));

    return { outputFile };
  }
}
