'use strict';

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '(?:src/.*|test/unit/.*)\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  maxWorkers: 1,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^prisma/prisma.service$': '<rootDir>/src/database/prisma.service',
  },
  testTimeout: 30_000,
};
