module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Include tests in __tests__ folders in addition to *.test.ts files
  testMatch: ['**/*.test.ts', '**/__tests__/**/*.ts'],
};
