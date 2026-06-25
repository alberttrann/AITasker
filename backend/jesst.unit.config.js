'use strict';

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              '.',
  testEnvironment:      'node',

  testRegex: '(src/.*\\.spec\\.ts$)|(test/smoke/.*\\.spec\\.ts$)|(test/unit/.*\\.spec\\.ts$)',

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^src/(.*)$':     '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^prisma/(.*)$':    '<rootDir>/prisma/$1'
  },
  testTimeout: 10_000,
};