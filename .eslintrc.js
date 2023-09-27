module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ['airbnb', 'prettier'],
  plugins: ['prettier'],
  overrides: [],
  rules: {
    'prettier/prettier': 'error',
  },
};
