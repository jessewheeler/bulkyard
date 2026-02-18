import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig, buildConfigFromFlags, validateForExtract } from '../../core/config.js';
import { BulkyardDatabase } from '../../core/database.js';
import { extractObject, ExtractResult } from '../../core/extractor.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('bulkyard', 'bulkyard.extract');

/** Return type for the `bulkyard extract` command — an array of per-object extraction results. */
export type ExtractCommandResult = ExtractResult[];

export default class Extract extends SfCommand<ExtractCommandResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'config-file': Flags.file({
      char: 'c',
      summary: messages.getMessage('flags.config-file.summary'),
      exists: true,
      exactlyOne: ['config-file', 'sobject'],
    }),
    sobject: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.sobject.summary'),
      exactlyOne: ['config-file', 'sobject'],
    }),
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.query.summary'),
      dependsOn: ['sobject'],
    }),
    database: Flags.string({
      char: 'd',
      summary: messages.getMessage('flags.database.summary'),
      default: 'bulkyard.db',
      exclusive: ['config-file'],
    }),
    table: Flags.string({
      char: 't',
      summary: messages.getMessage('flags.table.summary'),
      dependsOn: ['sobject'],
    }),
  };

  public async run(): Promise<ExtractCommandResult> {
    const { flags } = await this.parse(Extract);
    const config = flags['config-file']
      ? loadConfig(flags['config-file'])
      : buildConfigFromFlags({
          sobject: flags.sobject!,
          database: flags.database,
          query: flags.query,
          table: flags.table,
        });
    validateForExtract(config);

    const conn = flags['target-org'].getConnection(flags['api-version']);
    const db = new BulkyardDatabase(config.database);
    const results: ExtractResult[] = [];

    try {
      for (const objConfig of config.objects) {
        this.spinner.start(messages.getMessage('info.extracting', [objConfig.object]));
        // eslint-disable-next-line no-await-in-loop
        const result = await extractObject(conn, db, objConfig);
        this.spinner.stop();

        if (result.success) {
          this.log(`  ${result.object} -> ${result.table}: ${result.recordCount} records`);
        } else {
          this.warn(messages.getMessage('error.objectFailed', [result.object, result.error ?? 'unknown']));
        }
        results.push(result);
      }

      this.log(messages.getMessage('info.complete'));
      this.styledHeader('Extract Results');
      this.table({
        data: results as unknown as Array<Record<string, unknown>>,
        columns: ['object', 'table', { key: 'recordCount', name: 'Records' }, 'success'],
      });
    } finally {
      db.close();
    }

    return results;
  }
}
