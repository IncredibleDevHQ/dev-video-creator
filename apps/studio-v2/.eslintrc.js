// studio-v2 has no airbnb rule set; this is just enough for the repo's
// lint-staged hook to parse the TypeScript sources.
module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: {},
  ignorePatterns: ['dist/', 'node_modules/', 'server/migrations/'],
}
