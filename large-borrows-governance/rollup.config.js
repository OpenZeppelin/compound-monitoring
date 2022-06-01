import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import builtins from 'builtin-modules';

export default {
  input: 'src/autotask.js',
  output: {
    file: 'dist/autotask.js',
    format: 'cjs',
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json({ compact: true }),
  ],
  external: [
    ...builtins,
    'ethers',
    'web3',
    'axios',
    '@datadog/datadog-api-client',
    '@gnosis.pm/safe-core-sdk',
    '@gnosis.pm/safe-ethers-adapters',
    'axios-retry',
    /^defender-relay-client(\/.*)?$/,
    /^defender-admin-client(\/.*)?$/,
    /^defender-autotask-client(\/.*)?$/,
    /^defender-autotask-utils(\/.*)?$/,
    /^defender-kvstore-client(\/.*)?$/,
    'graphql',
    'graphql-request'
  ],
};