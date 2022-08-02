const { Finding, FindingSeverity, FindingType } = require('forta-agent');

const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    // Initialize

    // Get list of borrowers

    // Get initial state of all borrowers
  };
}

function provideHandleBlock(data) {
  return async function handleBlock(blockEvent) {
    // Process the block
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    // Process transaction
  };
}

module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
