// Load test environment variables FIRST — before any module is imported.
// This ensures PrismaClient picks up the test DATABASE_URL at instantiation.
require('dotenv').config({ path: '.env.test' });

'use strict';

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              '.',
  testEnvironment:      'node',

  // Only pick up test files inside backend/test/
  testRegex:            'test/.*\\.spec\\.ts$',

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // CRITICAL: sequential execution — do NOT remove for financial/ledger tests.
  // Parallel workers would cause race conditions on wallet balances and escrow state.
  runInBand: true,

  // Mirror tsconfig paths so src/ imports resolve in tests.
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$':       '<rootDir>/src/$1',
    '^@common/(.*)$':   '<rootDir>/src/common/$1',
    '^@shared/(.*)$':   '<rootDir>/src/shared/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^prisma/(.*)$':    '<rootDir>/prisma/$1'
  },

  // 30 seconds per test — integration tests hit a real DB and may do LLM calls.
  testTimeout: 30_000,

  // Stop the entire suite on the first failing test file.
  // Prevents a broken seeder from cascading into 20 false failures.
  bail: 1,
};