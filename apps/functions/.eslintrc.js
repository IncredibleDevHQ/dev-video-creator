const eslintNext = require('config/eslint-next.js')

module.exports = {
	...eslintNext,
	parserOptions: {
		project: './tsconfig.json',
		tsconfigRootDir: __dirname,
		ignorePatterns: [
			'**/*.js',
			'**/*.json',
			'node_modules',
			'public',
			'styles',
			'.next',
			'coverage',
			'dist',
			'.turbo',
			'**/*/graphql/generated.ts',
			'**/*/graphql/generated-ssr.ts',
			'**/*/graphql.schema.json',
		],
	},
	rules: {
		...eslintNext.rules,
		'import/prefer-default-export': 'off',
	},
}
