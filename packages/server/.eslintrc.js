const eslintNode = require('config/eslint-node.js')

module.exports = {
	...eslintNode,
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: './tsconfig.json',
		sourceType: 'module',
		ecmaVersion: 2020,
	},
}
