import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../core/config.js';
import { BulkyardDatabase } from '../../core/database.js';
import { describeToFieldInfos } from '../../core/schema.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('bulkyard', 'bulkyard.schema');

/** Return type for the `bulkyard schema` command. */
export type SchemaCommandResult = { database: string; objects: string[] };

export default class Schema extends SfCommand<SchemaCommandResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    sobjects: Flags.string({
      summary: messages.getMessage('flags.sobjects.summary'),
      exactlyOne: ['sobjects', 'config-file'],
    }),
    'config-file': Flags.file({
      char: 'c',
      summary: messages.getMessage('flags.config-file.summary'),
      exists: true,
      exactlyOne: ['sobjects', 'config-file'],
    }),
    database: Flags.string({
      char: 'd',
      summary: messages.getMessage('flags.database.summary'),
      default: 'bulkyard.db',
      exclusive: ['config-file'],
    }),
  };

  public async run(): Promise<SchemaCommandResult> {
    const { flags } = await this.parse(Schema);

    let objectNames: string[];
    let dbPath: string;

    if (flags['config-file']) {
      const config = loadConfig(flags['config-file']);
      objectNames = config.objects.map((o) => o.object);
      dbPath = config.database;
    } else {
      objectNames = flags.sobjects!.split(',').map((s) => s.trim());
      dbPath = flags.database!;
    }

    const conn = flags['target-org'].getConnection(flags['api-version']);
    const db = new BulkyardDatabase(dbPath);

    try {
      db.createSchemaTable();

      for (const objectName of objectNames) {
        this.spinner.start(messages.getMessage('info.describing', [objectName]));
        // eslint-disable-next-line no-await-in-loop
        const describeResult = await conn.describe(objectName);
        const fieldInfos = describeToFieldInfos(describeResult);
        db.writeSchema(
          objectName,
          fieldInfos.map((f) => ({ fieldName: f.name, fieldType: f.type }))
        );
        this.spinner.stop();
        this.log(`  ${objectName}: ${fieldInfos.length} fields cached`);
      }

      this.log(messages.getMessage('info.complete'));
      this.styledHeader('Schema Cache Results');
      this.table({
        data: objectNames.map((name) => ({ object: name })) as unknown as Array<Record<string, unknown>>,
        columns: ['object'],
      });
    } finally {
      db.close();
    }

    return { database: dbPath, objects: objectNames };
  }
}
