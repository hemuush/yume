module.exports = {
  preset: 'jest-expo',
  modulePathIgnorePatterns: [
    '<rootDir>/.expo/',
    '<rootDir>/dist/',
    '<rootDir>/sites/',
    '<rootDir>/design-preview/',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  // The first test in a file pays for transforming its whole import tree, which can pass the 5s default on a slow or busy machine.
  testTimeout: 20000,
};
