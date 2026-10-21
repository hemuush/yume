module.exports = {
  preset: 'jest-expo',
  modulePathIgnorePatterns: [
    '<rootDir>/.expo/',
    '<rootDir>/dist/',
    '<rootDir>/sites/',
    '<rootDir>/design-preview/',
  ],
  // Jest 30 also collects .cjs/.mjs tests by default; scripts/*.test.cjs are node:test suites, run by test:security.
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/', '\\.cjs$'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  // The first test in a file pays for transforming its whole import tree, which can pass the 5s default on a slow or busy machine.
  testTimeout: 20000,
};
