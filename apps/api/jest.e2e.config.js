/**
 * End-to-end tests against the real application and a real (temporary) database.
 * They run serially (`--runInBand`) because they share a single SQLite file.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 30_000,
  globalSetup: '<rootDir>/test/global-setup.ts',
};
