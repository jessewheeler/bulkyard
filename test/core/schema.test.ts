import { expect } from 'chai';
import {
  containsSelectStar,
  extractObjectName,
  getQueryableFields,
  expandSelectStar,
  describeToFieldInfos,
  CachedFieldInfo,
} from '../../src/core/schema.js';

describe('schema', () => {
  describe('containsSelectStar', () => {
    it('returns true for SELECT * FROM Account', () => {
      expect(containsSelectStar('SELECT * FROM Account')).to.be.true;
    });

    it('returns true for lowercase select * from', () => {
      expect(containsSelectStar('select * from Account WHERE Name != null')).to.be.true;
    });

    it('returns false for SELECT Id FROM Account', () => {
      expect(containsSelectStar('SELECT Id FROM Account')).to.be.false;
    });

    it('returns false for SELECT Id, Name FROM Account', () => {
      expect(containsSelectStar('SELECT Id, Name FROM Account')).to.be.false;
    });
  });

  describe('extractObjectName', () => {
    it('extracts Account from SELECT * FROM Account', () => {
      expect(extractObjectName('SELECT * FROM Account')).to.equal('Account');
    });

    it('extracts object name with WHERE clause', () => {
      expect(extractObjectName('SELECT * FROM Contact WHERE Email != null')).to.equal('Contact');
    });

    it('throws on malformed query without FROM', () => {
      expect(() => extractObjectName('SELECT *')).to.throw('Unable to extract object name');
    });
  });

  describe('getQueryableFields', () => {
    it('excludes address and location fields', () => {
      const fields: CachedFieldInfo[] = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
        { name: 'BillingAddress', type: 'address' },
        { name: 'Geolocation__c', type: 'location' },
      ];
      const result = getQueryableFields(fields);
      expect(result).to.deep.equal([
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
      ]);
    });

    it('returns all fields when none are compound', () => {
      const fields: CachedFieldInfo[] = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
      ];
      expect(getQueryableFields(fields)).to.deep.equal(fields);
    });
  });

  describe('expandSelectStar', () => {
    it('replaces * with field names', () => {
      const fields: CachedFieldInfo[] = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
      ];
      expect(expandSelectStar('SELECT * FROM Account', fields)).to.equal('SELECT Id, Name FROM Account');
    });

    it('preserves WHERE clause', () => {
      const fields: CachedFieldInfo[] = [{ name: 'Id', type: 'id' }];
      expect(expandSelectStar('SELECT * FROM Account WHERE Name != null', fields)).to.equal(
        'SELECT Id FROM Account WHERE Name != null'
      );
    });

    it('preserves ORDER BY and LIMIT', () => {
      const fields: CachedFieldInfo[] = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
      ];
      expect(expandSelectStar('SELECT * FROM Account ORDER BY Name LIMIT 10', fields)).to.equal(
        'SELECT Id, Name FROM Account ORDER BY Name LIMIT 10'
      );
    });
  });

  describe('describeToFieldInfos', () => {
    it('maps describe fields to CachedFieldInfo[]', () => {
      const describeResult = {
        fields: [
          { name: 'Id', type: 'id', label: 'Record ID', length: 18 },
          { name: 'Name', type: 'string', label: 'Name', length: 255 },
        ],
      };
      const result = describeToFieldInfos(describeResult);
      expect(result).to.deep.equal([
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
      ]);
    });
  });
});
