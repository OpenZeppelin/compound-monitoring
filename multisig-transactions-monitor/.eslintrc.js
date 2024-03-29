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
    ecmaVersion: 12,
  },
  rules: {
  },
  overrides: [
    {
      files: '*',
      rules: {
        'no-plusplus': 'off',
        'no-continue': 'off',
        'no-console': 'off',
      },
    },
  ],
};
