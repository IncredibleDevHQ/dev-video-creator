module.exports = {
	env: {
		browser: true,
		es2021: true,
	},
	extends: [
		'airbnb',
		'airbnb-typescript',
		'plugin:import/recommended',
		'plugin:import/typescript',
		'prettier',
	],
	plugins: ['@typescript-eslint', 'import', 'react'],
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
	},
	rules: {
		// react
		'react/function-component-definition': [
			2,
			{
				namedComponents: 'arrow-function',
			},
		],
		'react/react-in-jsx-scope': 'off',
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
		'coverage',
		'dist',
		'.turbo',
	],
}
