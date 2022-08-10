const eslintNext = require('config/eslint-next.js')

module.exports = {
	...eslintNext,
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: './tsconfig.json',
	},
}
