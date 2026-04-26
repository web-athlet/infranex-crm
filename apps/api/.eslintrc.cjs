/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
    browser: false,
  },
  extends: ['../../.eslintrc.cjs'],
  ignorePatterns: ['dist/', 'node_modules/'],
};
