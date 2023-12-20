module.exports = {
  preset: 'ts-jest',
  maxWorkers: 1,
  testEnvironment: 'node',
  globals: {
      'ts-jest': {
          tsconfig: 'tsconfig.json'
      }
  },
  testMatch: ['**/?*.(spec|test|e2e).(j|t)s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
}
