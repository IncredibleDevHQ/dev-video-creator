const eslintReact = require('config/eslint-react.js')

module.exports = {
	...eslintReact,
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: './tsconfig.json',
	},
	rules: {
		...eslintReact.rules,
		'import/prefer-default-export': 'off',
	},
}
