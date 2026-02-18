import { expect } from 'chai';
import sinon from 'sinon';
import { loadObject } from '../../src/core/loader.js';
import { BulkyardDatabase } from '../../src/core/database.js';
import { BulkyardObjectConfig } from '../../src/core/config.js';

// Helper to build bulk result objects without triggering camelcase lint rule
function successResult(id: string): Record<string, string> {
  const r: Record<string, string> = {};
  r['sf__Id'] = id;
  return r;
}

function failedResult(id: string, error: string): Record<string, string> {
  const r: Record<string, string> = {};
  r['sf__Id'] = id;
  r['sf__Error'] = error;
  return r;
}

describe('loadObject', () => {
  let db: BulkyardDatabase;

  beforeEach(() => {
    db = new BulkyardDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
    sinon.restore();
  });

  it('returns error when table does not exist', async () => {
    const conn = { bulk2: {} };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      operation: 'insert',
    };

    const result = await loadObject(conn as never, db, objConfig);

    expect(result.success).to.be.false;
    expect(result.errors[0]).to.include('does not exist');
  });

  it('returns success with zero records for empty table', async () => {
    db.createTable('Account', [{ name: 'Id', sfType: 'id' }]);
    const conn = { bulk2: {} };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      operation: 'insert',
    };

    const result = await loadObject(conn as never, db, objConfig);

    expect(result.success).to.be.true;
    expect(result.totalRecords).to.equal(0);
  });

  it('loads records via bulk2 and returns results', async () => {
    db.createTable('Account', [
      { name: 'Id', sfType: 'id' },
      { name: 'Name', sfType: 'string' },
    ]);
    db.insertRecords(
      'Account',
      ['Id', 'Name'],
      [
        { Id: '001', Name: 'Acme' },
        { Id: '002', Name: 'Globex' },
      ]
    );

    const loadStub = sinon.stub().resolves({
      successfulResults: [successResult('001'), successResult('002')],
      failedResults: [],
    });
    const conn = { bulk2: { loadAndWaitForResults: loadStub } };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      operation: 'insert',
    };

    const result = await loadObject(conn as never, db, objConfig);

    expect(result.success).to.be.true;
    expect(result.totalRecords).to.equal(2);
    expect(result.successCount).to.equal(2);
    expect(result.failureCount).to.equal(0);

    const callArgs = loadStub.firstCall.args[0] as Record<string, unknown>;
    expect(callArgs.object).to.equal('Account');
    expect(callArgs.operation).to.equal('insert');
    expect(callArgs.input).to.have.lengthOf(2);
  });

  it('reports failures from bulk results', async () => {
    db.createTable('Account', [{ name: 'Id', sfType: 'id' }]);
    db.insertRecords('Account', ['Id'], [{ Id: '001' }]);

    const loadStub = sinon.stub().resolves({
      successfulResults: [],
      failedResults: [failedResult('001', 'DUPLICATE_VALUE')],
    });
    const conn = { bulk2: { loadAndWaitForResults: loadStub } };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      operation: 'insert',
    };

    const result = await loadObject(conn as never, db, objConfig);

    expect(result.success).to.be.false;
    expect(result.failureCount).to.equal(1);
    expect(result.errors[0]).to.include('DUPLICATE_VALUE');
  });

  it('passes externalIdFieldName for upsert', async () => {
    db.createTable('Account', [{ name: 'Id', sfType: 'id' }]);
    db.insertRecords('Account', ['Id'], [{ Id: '001' }]);

    const loadStub = sinon.stub().resolves({
      successfulResults: [successResult('001')],
      failedResults: [],
    });
    const conn = { bulk2: { loadAndWaitForResults: loadStub } };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      operation: 'upsert',
      externalIdField: 'Id',
    };

    const result = await loadObject(conn as never, db, objConfig);

    expect(result.success).to.be.true;
    const callArgs = loadStub.firstCall.args[0] as Record<string, unknown>;
    expect(callArgs.externalIdFieldName).to.equal('Id');
  });

  it('uses custom table name', async () => {
    db.createTable('Account_Staging', [{ name: 'Id', sfType: 'id' }]);
    db.insertRecords('Account_Staging', ['Id'], [{ Id: '001' }]);

    const loadStub = sinon.stub().resolves({
      successfulResults: [successResult('001')],
      failedResults: [],
    });
    const conn = { bulk2: { loadAndWaitForResults: loadStub } };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      operation: 'insert',
      table: 'Account_Staging',
    };

    const result = await loadObject(conn as never, db, objConfig);

    expect(result.table).to.equal('Account_Staging');
  });

  it('returns error result on API exception', async () => {
    db.createTable('Account', [{ name: 'Id', sfType: 'id' }]);
    db.insertRecords('Account', ['Id'], [{ Id: '001' }]);

    const conn = {
      bulk2: {
        loadAndWaitForResults: sinon.stub().rejects(new Error('Connection timeout')),
      },
    };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      operation: 'insert',
    };

    const result = await loadObject(conn as never, db, objConfig);

    expect(result.success).to.be.false;
    expect(result.errors[0]).to.include('Connection timeout');
  });
});
