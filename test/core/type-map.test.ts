import { expect } from 'chai';
import { sfTypeToSqlite } from '../../src/core/type-map.js';

describe('sfTypeToSqlite', () => {
  it('maps integer types to INTEGER', () => {
    expect(sfTypeToSqlite('int')).to.equal('INTEGER');
    expect(sfTypeToSqlite('integer')).to.equal('INTEGER');
    expect(sfTypeToSqlite('long')).to.equal('INTEGER');
  });

  it('maps boolean to INTEGER', () => {
    expect(sfTypeToSqlite('boolean')).to.equal('INTEGER');
  });

  it('maps numeric types to REAL', () => {
    expect(sfTypeToSqlite('double')).to.equal('REAL');
    expect(sfTypeToSqlite('currency')).to.equal('REAL');
    expect(sfTypeToSqlite('percent')).to.equal('REAL');
  });

  it('maps string-like types to TEXT', () => {
    expect(sfTypeToSqlite('string')).to.equal('TEXT');
    expect(sfTypeToSqlite('id')).to.equal('TEXT');
    expect(sfTypeToSqlite('reference')).to.equal('TEXT');
    expect(sfTypeToSqlite('textarea')).to.equal('TEXT');
    expect(sfTypeToSqlite('url')).to.equal('TEXT');
    expect(sfTypeToSqlite('email')).to.equal('TEXT');
    expect(sfTypeToSqlite('phone')).to.equal('TEXT');
    expect(sfTypeToSqlite('picklist')).to.equal('TEXT');
    expect(sfTypeToSqlite('multipicklist')).to.equal('TEXT');
  });

  it('maps date/time types to TEXT', () => {
    expect(sfTypeToSqlite('date')).to.equal('TEXT');
    expect(sfTypeToSqlite('datetime')).to.equal('TEXT');
    expect(sfTypeToSqlite('time')).to.equal('TEXT');
  });

  it('maps base64 to BLOB', () => {
    expect(sfTypeToSqlite('base64')).to.equal('BLOB');
  });

  it('is case-insensitive', () => {
    expect(sfTypeToSqlite('Boolean')).to.equal('INTEGER');
    expect(sfTypeToSqlite('STRING')).to.equal('TEXT');
    expect(sfTypeToSqlite('Double')).to.equal('REAL');
  });

  it('defaults unknown types to TEXT', () => {
    expect(sfTypeToSqlite('foobar')).to.equal('TEXT');
    expect(sfTypeToSqlite('unknowntype')).to.equal('TEXT');
  });
});
