import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import Schema from '../../../src/commands/bulkyard/schema.js';

describe('bulkyard schema', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('defines expected flags', () => {
    expect(Schema.flags).to.have.property('target-org');
    expect(Schema.flags).to.have.property('api-version');
    expect(Schema.flags).to.have.property('sobjects');
    expect(Schema.flags).to.have.property('config-file');
    expect(Schema.flags).to.have.property('database');
  });

  it('has a summary', () => {
    expect(Schema.summary).to.be.a('string').and.not.empty;
  });

  it('has a description', () => {
    expect(Schema.description).to.be.a('string').and.not.empty;
  });

  it('has examples', () => {
    expect(Schema.examples).to.be.an('array').with.length.greaterThan(0);
  });
});
