const { ethers } = require('forta-agent');

const abi = [`function getAssetInfo(uint8 i) view returns (tuple(
  uint8 offset,
  address asset,
  address priceFeed,
  uint64 scale,
  uint64 borrowCollateralFactor,
  uint64 liquidateCollateralFactor,
  uint64 liquidationFactor,
  uint128 supplyCap))`];

const iface = new ethers.utils.Interface(abi);

const mockBtcInfo = [
  1,
  '0xcd113733263bF5BCd01CE6c2618CB59DC1618139',
  '0x6135b13325bfC4B00278B4abC5e20bbce2D6580e',
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
];

// Works but the data is nested an array
// const encoded = iface.encodeFunctionResult('getAssetInfo', [mockBtcInfo]);

// Doesn't work
const encoded = iface.encodeFunctionResult('getAssetInfo', mockBtcInfo);

console.debug(encoded);

const decoded = iface.decodeFunctionResult('getAssetInfo', encoded);
console.debug(typeof decoded);
console.debug(JSON.stringify(decoded));

// 
console.debug(decoded[0]);
