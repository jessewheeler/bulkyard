import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { loadConfig, buildConfigFromFlags, validateForExtract, validateForLoad } from '../../src/core/config.js';

describe('config', () => {
  let tempDir: string;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'by-test-'));
  });

  function writeYaml(name: string, content: string): string {
    const filePath = join(tempDir, name);
    writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  describe('loadConfig', () => {
    it('parses a valid config file', () => {
      const path = writeYaml(
        'valid.yml',
        `
database: ./test.db
objects:
  - object: Account
    query: "SELECT Id, Name FROM Account"
    operation: upsert
    externalIdField: Id
  - object: Contact
    query: "SELECT Id, FirstName FROM Contact"
    operation: insert
    table: Contact_Staging
`
      );
      const config = loadConfig(path);
      expect(config.database).to.equal('./test.db');
      expect(config.objects).to.have.lengthOf(2);
      expect(config.objects[0].object).to.equal('Account');
      expect(config.objects[1].table).to.equal('Contact_Staging');
    });

    it('throws if database is missing', () => {
      const path = writeYaml(
        'no-db.yml',
        `
objects:
  - object: Account
    query: "SELECT Id FROM Account"
`
      );
      expect(() => loadConfig(path)).to.throw(SfError, 'database');
    });

    it('throws if objects is empty', () => {
      const path = writeYaml(
        'empty-objects.yml',
        `
database: ./test.db
objects: []
`
      );
      expect(() => loadConfig(path)).to.throw(SfError, 'non-empty');
    });

    it('throws if objects is missing', () => {
      const path = writeYaml(
        'no-objects.yml',
        `
database: ./test.db
`
      );
      expect(() => loadConfig(path)).to.throw(SfError, 'non-empty');
    });

    it('throws if an object entry has no object field', () => {
      const path = writeYaml(
        'no-object-field.yml',
        `
database: ./test.db
objects:
  - query: "SELECT Id FROM Account"
`
      );
      expect(() => loadConfig(path)).to.throw(SfError, '"object" field');
    });
  });

  describe('buildConfigFromFlags', () => {
    it('builds a config with all flags provided', () => {
      const config = buildConfigFromFlags({
        sobject: 'Account',
        database: './test.db',
        query: 'SELECT Id FROM Account',
        operation: 'upsert',
        externalIdField: 'Id',
        table: 'Account_Staging',
      });
      expect(config.database).to.equal('./test.db');
      expect(config.objects).to.have.lengthOf(1);
      expect(config.objects[0].object).to.equal('Account');
      expect(config.objects[0].query).to.equal('SELECT Id FROM Account');
      expect(config.objects[0].operation).to.equal('upsert');
      expect(config.objects[0].externalIdField).to.equal('Id');
      expect(config.objects[0].table).to.equal('Account_Staging');
    });

    it('omits optional fields when not provided', () => {
      const config = buildConfigFromFlags({
        sobject: 'Contact',
        database: 'bulkyard.db',
      });
      expect(config.database).to.equal('bulkyard.db');
      expect(config.objects).to.have.lengthOf(1);
      expect(config.objects[0].object).to.equal('Contact');
      expect(config.objects[0]).to.not.have.property('query');
      expect(config.objects[0]).to.not.have.property('operation');
      expect(config.objects[0]).to.not.have.property('externalIdField');
      expect(config.objects[0]).to.not.have.property('table');
    });

    it('produces a config that passes validateForExtract when query is provided', () => {
      const config = buildConfigFromFlags({
        sobject: 'Account',
        database: './test.db',
        query: 'SELECT Id FROM Account',
      });
      expect(() => validateForExtract(config)).to.not.throw();
    });

    it('produces a config that passes validateForLoad when operation is provided', () => {
      const config = buildConfigFromFlags({
        sobject: 'Account',
        database: './test.db',
        operation: 'insert',
      });
      expect(() => validateForLoad(config)).to.not.throw();
    });
  });

  describe('validateForExtract', () => {
    it('passes when all objects have queries', () => {
      const config = loadConfig(
        writeYaml(
          'extract-valid.yml',
          `
database: ./test.db
objects:
  - object: Account
    query: "SELECT Id FROM Account"
`
        )
      );
      expect(() => validateForExtract(config)).to.not.throw();
    });

    it('throws when an object is missing a query', () => {
      const config = loadConfig(
        writeYaml(
          'extract-no-query.yml',
          `
database: ./test.db
objects:
  - object: Account
`
        )
      );
      expect(() => validateForExtract(config)).to.throw(SfError, 'query');
    });
  });

  describe('validateForLoad', () => {
    it('passes when all objects have operations', () => {
      const config = loadConfig(
        writeYaml(
          'load-valid.yml',
          `
database: ./test.db
objects:
  - object: Account
    operation: insert
`
        )
      );
      expect(() => validateForLoad(config)).to.not.throw();
    });

    it('throws when an object is missing an operation', () => {
      const config = loadConfig(
        writeYaml(
          'load-no-op.yml',
          `
database: ./test.db
objects:
  - object: Account
`
        )
      );
      expect(() => validateForLoad(config)).to.throw(SfError, 'operation');
    });

    it('throws when upsert is missing externalIdField', () => {
      const config = loadConfig(
        writeYaml(
          'load-upsert-no-ext.yml',
          `
database: ./test.db
objects:
  - object: Account
    operation: upsert
`
        )
      );
      expect(() => validateForLoad(config)).to.throw(SfError, 'externalIdField');
    });

    it('passes for upsert with externalIdField', () => {
      const config = loadConfig(
        writeYaml(
          'load-upsert-ok.yml',
          `
database: ./test.db
objects:
  - object: Account
    operation: upsert
    externalIdField: Id
`
        )
      );
      expect(() => validateForLoad(config)).to.not.throw();
    });
  });
});
