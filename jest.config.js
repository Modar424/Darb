/** @type {import('jest').Config} */
const base = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: true }] },
  testEnvironment: 'node',
};

module.exports = {
  testTimeout: 60000,
  projects: [
    { ...base, displayName: 'unit', rootDir: 'src', testRegex: '.*\\.spec\\.ts$' },
    {
      ...base,
      displayName: 'integration',
      rootDir: 'test',
      testRegex: '.*\\.e2e-spec\\.ts$',
      globalSetup: '<rootDir>/global-setup.ts',
      setupFiles: ['<rootDir>/setup-env.ts'],
    },
  ],
};
