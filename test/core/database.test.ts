import { expect } from 'chai';
import { BulkyardDatabase } from '../../src/core/database.js';

describe('BulkyardDatabase', () => {
  let db: BulkyardDatabase;

  beforeEach(() => {
    db = new BulkyardDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('createTable', () => {
    it('creates a table with typed columns', () => {
      db.createTable('Account', [
        { name: 'Id', sfType: 'id' },
        { name: 'Name', sfType: 'string' },
        { name: 'Revenue', sfType: 'currency' },
        { name: 'Active', sfType: 'boolean' },
      ]);
      expect(db.tableExists('Account')).to.be.true;
      expect(db.getTableColumns('Account')).to.deep.equal(['Id', 'Name', 'Revenue', 'Active']);
    });

    it('drops existing table before creating', () => {
      db.createTable('Test', [{ name: 'Col1', sfType: 'string' }]);
      db.insertRecords('Test', ['Col1'], [{ Col1: 'value' }]);
      expect(db.getRowCount('Test')).to.equal(1);

      db.createTable('Test', [
        { name: 'Col1', sfType: 'string' },
        { name: 'Col2', sfType: 'int' },
      ]);
      expect(db.getRowCount('Test')).to.equal(0);
      expect(db.getTableColumns('Test')).to.deep.equal(['Col1', 'Col2']);
    });
  });

  describe('insertRecords', () => {
    beforeEach(() => {
      db.createTable('Test', [
        { name: 'Id', sfType: 'id' },
        { name: 'Name', sfType: 'string' },
        { name: 'Active', sfType: 'boolean' },
        { name: 'Count', sfType: 'int' },
      ]);
    });

    it('inserts records and reads them back', () => {
      const records = [
        { Id: '001', Name: 'Acme', Active: true, Count: 10 },
        { Id: '002', Name: 'Globex', Active: false, Count: 20 },
      ];
      db.insertRecords('Test', ['Id', 'Name', 'Active', 'Count'], records);

      const rows = db.readAllRows('Test');
      expect(rows).to.have.lengthOf(2);
      expect(rows[0]).to.deep.include({ Id: '001', Name: 'Acme', Active: 1, Count: 10 });
      expect(rows[1]).to.deep.include({ Id: '002', Name: 'Globex', Active: 0, Count: 20 });
    });

    it('converts null and undefined to NULL', () => {
      db.insertRecords(
        'Test',
        ['Id', 'Name', 'Active', 'Count'],
        [{ Id: '001', Name: null, Active: undefined, Count: null }]
      );
      const rows = db.readAllRows('Test');
      expect(rows[0]).to.deep.include({ Id: '001', Name: null, Active: null, Count: null });
    });

    it('converts objects to JSON strings', () => {
      db.createTable('JsonTest', [{ name: 'Data', sfType: 'string' }]);
      db.insertRecords('JsonTest', ['Data'], [{ Data: { foo: 'bar' } }]);
      const rows = db.readAllRows('JsonTest');
      expect(rows[0].Data).to.equal('{"foo":"bar"}');
    });

    it('handles batching for many records', () => {
      db.createTable('Batch', [{ name: 'Id', sfType: 'int' }]);
      const records = Array.from({ length: 2500 }, (_, i) => ({ Id: i }));
      db.insertRecords('Batch', ['Id'], records);
      expect(db.getRowCount('Batch')).to.equal(2500);
    });
  });

  describe('tableExists', () => {
    it('returns false for non-existent table', () => {
      expect(db.tableExists('DoesNotExist')).to.be.false;
    });

    it('returns true for existing table', () => {
      db.createTable('Exists', [{ name: 'Id', sfType: 'string' }]);
      expect(db.tableExists('Exists')).to.be.true;
    });
  });

  describe('getRowCount', () => {
    it('returns 0 for empty table', () => {
      db.createTable('Empty', [{ name: 'Id', sfType: 'string' }]);
      expect(db.getRowCount('Empty')).to.equal(0);
    });
  });
});
