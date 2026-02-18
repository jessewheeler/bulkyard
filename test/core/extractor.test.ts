import { expect } from 'chai';
import sinon from 'sinon';
import { extractObject } from '../../src/core/extractor.js';
import { BulkyardDatabase } from '../../src/core/database.js';
import { BulkyardObjectConfig } from '../../src/core/config.js';

describe('extractObject', () => {
  let db: BulkyardDatabase;

  beforeEach(() => {
    db = new BulkyardDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
    sinon.restore();
  });

  function makeConn(records: Array<Record<string, unknown>>, fields: Array<{ name: string; type: string }>): unknown {
    return {
      bulk2: {
        query: sinon.stub().resolves({
          toArray: sinon.stub().resolves(records),
        }),
      },
      describe: sinon.stub().resolves({ fields }),
    };
  }

  it('extracts records into SQLite table', async () => {
    const records = [
      { attributes: { type: 'Account' }, Id: '001', Name: 'Acme' },
      { attributes: { type: 'Account' }, Id: '002', Name: 'Globex' },
    ];
    const fields = [
      { name: 'Id', type: 'id' },
      { name: 'Name', type: 'string' },
    ];
    const conn = makeConn(records, fields);
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id, Name FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.true;
    expect(result.recordCount).to.equal(2);
    expect(result.table).to.equal('Account');
    expect(db.tableExists('Account')).to.be.true;

    const rows = db.readAllRows('Account');
    expect(rows).to.have.lengthOf(2);
    expect(rows[0]).to.deep.include({ Id: '001', Name: 'Acme' });
  });

  it('uses custom table name when provided', async () => {
    const conn = makeConn([{ Id: '001' }], [{ name: 'Id', type: 'id' }]);
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id FROM Account',
      table: 'Account_Staging',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.table).to.equal('Account_Staging');
    expect(db.tableExists('Account_Staging')).to.be.true;
  });

  it('handles zero records', async () => {
    const conn = makeConn([], []);
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.true;
    expect(result.recordCount).to.equal(0);
  });

  it('returns error result on failure', async () => {
    const conn = {
      bulk2: {
        query: sinon.stub().rejects(new Error('API error')),
      },
    };
    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.false;
    expect(result.error).to.include('API error');
  });
});
