import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import Load from '../../../src/commands/bulkyard/load.js';

describe('bulkyard load', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('defines expected flags', () => {
    expect(Load.flags).to.have.property('target-org');
    expect(Load.flags).to.have.property('api-version');
    expect(Load.flags).to.have.property('config-file');
    expect(Load.flags).to.have.property('sobject');
    expect(Load.flags).to.have.property('operation');
    expect(Load.flags).to.have.property('external-id-field');
    expect(Load.flags).to.have.property('database');
    expect(Load.flags).to.have.property('table');
  });

  it('has a summary', () => {
    expect(Load.summary).to.be.a('string').and.not.empty;
  });

  it('has a description', () => {
    expect(Load.description).to.be.a('string').and.not.empty;
  });

  it('has examples', () => {
    expect(Load.examples).to.be.an('array').with.length.greaterThan(0);
  });
});
