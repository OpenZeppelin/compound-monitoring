// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  ethers: {
    ...jest.requireActual('ethers'),
  },
}));

const {
  TransactionEvent, ethers, FindingType, FindingSeverity, Finding
} = require('forta-agent');

const config = require('../agent-config.json');

describe('check agent configuration file', () => {
  it('has a developer abbreviation', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('has a protocol name', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('has a protocol abbreviation', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('has a valid comp token address and abi', () => {
    const { compERC20 } = config;
    const { address, abi } = compERC20;
    expect(ethers.utils.isHexString(address, 20)).toBe(true);
    expect(typeof (abi)).toBe('string');
    expect(abi).not.toBe('');
  });

  it('has a valid governor bravo address and api ', () => {
    const { governorBravo } = config;
    const { address, abi } = governorBravo;
    expect(ethers.utils.isHexString(address, 20)).toBe(true);
    expect(typeof (abi)).toBe('string');
    expect(abi).not.toBe('');
  });
});
