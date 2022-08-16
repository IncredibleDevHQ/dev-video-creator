module.exports = {
	env: {
		browser: true,
		node: true,
	},
	extends: [
		'airbnb',
		'airbnb-typescript',
		'plugin:import/recommended',
		'plugin:import/typescript',
		'plugin:node/recommended',
		'prettier',
	],
	plugins: ['@typescript-eslint', 'import'],
	settings: {
		'import/parsers': {
			'@typescript-eslint/parser': ['.ts', '.tsx'],
		},
		'import/resolver': {
			typescript: {
				alwaysTryTypes: true,
				project: ['apps/*/tsconfig.json'],
			},
		},
		node: {
			tryExtensions: ['.js', '.json', '.node', '.ts', '.d.ts'],
		},
	},
	rules: {
		'node/no-unsupported-features/es-syntax': [
			'error',
			{ ignores: ['modules'] },
		],
		'no-console': 'off',
	},
	overrides: [
		{
			// 3) Now we enable eslint-plugin-testing-library rules or preset only for matching files!
			env: {
				jest: true,
			},
			files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
			extends: ['plugin:testing-library/react', 'plugin:jest/recommended'],
			rules: {
				'import/no-extraneous-dependencies': [
					'off',
					{ devDependencies: ['**/?(*.)+(spec|test).[jt]s?(x)'] },
				],
			},
		},
	],
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
}
