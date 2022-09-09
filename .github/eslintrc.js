module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    jest: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
  },
  overrides: [
    {
      files: '*',
      rules: {
        'no-plusplus': 'off',
        'no-console': 'off',
        // When linting from the root directory, eslint doesn't check sub-directory modules
        // so this gives many false positives.
        'import/no-unresolved': 'off',
      },
    },
  ],
};
