import { expect } from 'chai';
import sinon from 'sinon';
import { extractObject } from '../../src/core/extractor.js';
import { BulkyardDatabase } from '../../src/core/database.js';
import { BulkyardObjectConfig } from '../../src/core/config.js';

const API_VERSION = '59.0';
const INSTANCE_URL = 'https://test.salesforce.com';
const ACCESS_TOKEN = 'test-token';

function makeConn(overrides: Record<string, unknown> = {}): unknown {
  return {
    instanceUrl: INSTANCE_URL,
    accessToken: ACCESS_TOKEN,
    getApiVersion: sinon.stub().returns(API_VERSION),
    describe: sinon.stub().resolves({ fields: [] }),
    requestPost: sinon.stub().resolves({ id: 'job-123', state: 'UploadComplete' }),
    requestGet: sinon.stub().resolves({ id: 'job-123', state: 'JobComplete' }),
    ...overrides,
  };
}

describe('extractObject', () => {
  let db: BulkyardDatabase;
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    db = new BulkyardDatabase(':memory:');
    fetchStub = sinon.stub(globalThis, 'fetch' as never);
  });

  afterEach(() => {
    db.close();
    sinon.restore();
  });

  it('extracts records into SQLite table', async () => {
    const conn = makeConn({
      describe: sinon.stub().resolves({
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'Name', type: 'string' },
        ],
      }),
    });
    fetchStub.resolves({
      ok: true,
      headers: new Headers({ 'sforce-locator': 'null' }),
      text: async () => 'Id,Name\n001,Acme\n002,Globex\n',
    });

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
    const conn = makeConn();
    fetchStub.resolves({
      ok: true,
      headers: new Headers({ 'sforce-locator': 'null' }),
      text: async () => 'Id\n001\n',
    });

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
    const conn = makeConn();
    fetchStub.resolves({
      ok: true,
      headers: new Headers({ 'sforce-locator': 'null' }),
      text: async () => '',
    });

    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.true;
    expect(result.recordCount).to.equal(0);
  });

  it('fetches multiple locator pages and combines results', async () => {
    const conn = makeConn();
    const page1Headers = new Headers({ 'sforce-locator': 'page2token' });
    const page2Headers = new Headers({ 'sforce-locator': 'null' });
    fetchStub
      .onCall(0)
      .resolves({ ok: true, headers: page1Headers, text: async () => 'Id,Name\n001,Acme\n002,Globex\n' });
    fetchStub.onCall(1).resolves({ ok: true, headers: page2Headers, text: async () => 'Id,Name\n003,Initech\n' });

    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id, Name FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.true;
    expect(result.recordCount).to.equal(3);
    expect(fetchStub.callCount).to.equal(2);

    expect(fetchStub.getCall(1).args[0] as string).to.include('locator=page2token');
  });

  it('returns error result on job creation failure', async () => {
    const conn = makeConn({
      requestPost: sinon.stub().rejects(new Error('API error')),
    });

    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.false;
    expect(result.error).to.include('API error');
  });

  it('returns error result when job fails', async () => {
    const conn = makeConn({
      requestGet: sinon.stub().resolves({ id: 'job-123', state: 'Failed', errorMessage: 'query error' }),
    });

    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.false;
    expect(result.error).to.include('Failed');
    expect(result.error).to.include('query error');
  });

  it('returns error result when results fetch fails', async () => {
    const conn = makeConn();
    fetchStub.resolves({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const objConfig: BulkyardObjectConfig = {
      object: 'Account',
      query: 'SELECT Id FROM Account',
    };

    const result = await extractObject(conn as never, db, objConfig);

    expect(result.success).to.be.false;
    expect(result.error).to.include('500');
  });

  it('converts empty CSV values to null', async () => {
    const conn = makeConn({
      describe: sinon.stub().resolves({
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'Name', type: 'string' },
        ],
      }),
    });
    fetchStub.resolves({
      ok: true,
      headers: new Headers({ 'sforce-locator': 'null' }),
      text: async () => 'Id,Name\n001,\n',
    });

    const result = await extractObject(conn as never, db, {
      object: 'Account',
      query: 'SELECT Id, Name FROM Account',
    });

    expect(result.success).to.be.true;
    const rows = db.readAllRows('Account');
    expect(rows[0]).to.deep.include({ Id: '001', Name: null });
  });
});
