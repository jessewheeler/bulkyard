import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import Extract from '../../../src/commands/bulkyard/extract.js';

describe('bulkyard extract', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('defines expected flags', () => {
    expect(Extract.flags).to.have.property('target-org');
    expect(Extract.flags).to.have.property('api-version');
    expect(Extract.flags).to.have.property('config-file');
    expect(Extract.flags).to.have.property('sobject');
    expect(Extract.flags).to.have.property('query');
    expect(Extract.flags).to.have.property('database');
    expect(Extract.flags).to.have.property('table');
  });

  it('has a summary', () => {
    expect(Extract.summary).to.be.a('string').and.not.empty;
  });

  it('has a description', () => {
    expect(Extract.description).to.be.a('string').and.not.empty;
  });

  it('has examples', () => {
    expect(Extract.examples).to.be.an('array').with.length.greaterThan(0);
  });
});
