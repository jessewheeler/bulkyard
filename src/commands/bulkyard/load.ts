import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig, buildConfigFromFlags, validateForLoad } from '../../core/config.js';
import { BulkyardDatabase } from '../../core/database.js';
import { loadObject, LoadResult } from '../../core/loader.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('bulkyard', 'bulkyard.load');

export type LoadCommandResult = LoadResult[];

export default class Load extends SfCommand<LoadCommandResult> {
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
    operation: Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.operation.summary'),
      options: ['insert', 'update', 'upsert', 'delete'],
      dependsOn: ['sobject'],
    }),
    'external-id-field': Flags.string({
      char: 'e',
      summary: messages.getMessage('flags.external-id-field.summary'),
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

  public async run(): Promise<LoadCommandResult> {
    const { flags } = await this.parse(Load);
    const config = flags['config-file']
      ? loadConfig(flags['config-file'])
      : buildConfigFromFlags({
          sobject: flags.sobject!,
          database: flags.database,
          operation: flags.operation,
          externalIdField: flags['external-id-field'],
          table: flags.table,
        });
    validateForLoad(config);

    const conn = flags['target-org'].getConnection(flags['api-version']);
    const db = new BulkyardDatabase(config.database);
    const results: LoadResult[] = [];

    try {
      for (const objConfig of config.objects) {
        this.spinner.start(messages.getMessage('info.loading', [objConfig.object]));
        // eslint-disable-next-line no-await-in-loop
        const result = await loadObject(conn, db, objConfig);
        this.spinner.stop();

        if (result.success) {
          this.log(`  ${result.object}: ${result.successCount}/${result.totalRecords} succeeded`);
        } else {
          this.warn(messages.getMessage('error.objectFailed', [result.object, result.errors.join('; ')]));
        }
        results.push(result);
      }

      this.log(messages.getMessage('info.complete'));
      this.styledHeader('Load Results');
      this.table({
        data: results as unknown as Array<Record<string, unknown>>,
        columns: [
          'object',
          'table',
          { key: 'totalRecords', name: 'Total' },
          { key: 'successCount', name: 'Success' },
          { key: 'failureCount', name: 'Failures' },
          'success',
        ],
      });
    } finally {
      db.close();
    }

    return results;
  }
}
