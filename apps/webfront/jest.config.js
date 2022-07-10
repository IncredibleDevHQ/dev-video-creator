/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testPathIgnorePatterns: ['.next/', 'node_modules/'],
	testMatch: ['**/**/*.test.ts'],
	verbose: true,
	forceExit: true,
	detectOpenHandles: true,
	moduleFileExtensions: ['ts', 'js'],
	moduleNameMapper: {
		'src/(.*)': '<rootDir>/src/$1',
	},
}
