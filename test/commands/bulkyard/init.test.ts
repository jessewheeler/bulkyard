import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import Init from '../../../src/commands/bulkyard/init.js';

describe('bulkyard init', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('defines expected flags', () => {
    expect(Init.flags).to.have.property('output-file');
    expect(Init.flags).to.have.property('force');
  });

  it('has a summary', () => {
    expect(Init.summary).to.be.a('string').and.not.empty;
  });

  it('has a description', () => {
    expect(Init.description).to.be.a('string').and.not.empty;
  });

  it('has examples', () => {
    expect(Init.examples).to.be.an('array').with.length.greaterThan(0);
  });
});
