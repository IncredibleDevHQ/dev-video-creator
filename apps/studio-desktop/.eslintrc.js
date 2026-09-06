// studio-desktop follows studio-v2's convention: no airbnb rule set, just
// enough for the repo's lint-staged hook to parse the TypeScript sources.
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: {},
  ignorePatterns: ['dist-electron/', 'scripts/', 'build.mjs'],
}
