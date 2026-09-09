module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/database.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // The firebase-admin modular subpaths load `jose`, which is ESM-only and cannot be
  // required under Jest's CommonJS runtime — it broke every suite that requires
  // src/server.js. Route tests don't verify Firebase ID tokens, so stub the SDK.
  moduleNameMapper: {
    '^firebase-admin/(app|auth)$': '<rootDir>/tests/stubs/firebaseAdminSdk.js'
  },
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};