const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require('forta-agent');

// require the agent
const { provideHandleTransaction, provideInitialize,} = require('./agent');

const config = require('../agent-config.json');

// check config file
describe('check agent configuration file', () => {
  it('has a protocolName', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('has a protocolAbbreviation', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('has a developerAbbreviation', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('has a multisig key', () => {
    const { multisig } = config;
    expect(typeof (multisig)).toBe('object');
    expect(multisig).not.toBe({});
  });

  it('has valid multisig values', () => {
    const { multisig } = config;
    const { address, events } = multisig;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // check that there are events
    expect(events).not.toBe([]);
  })
});

describe('Compound Finance multisig transaction agent', () => {

});