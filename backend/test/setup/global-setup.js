// Runs once before the entire test suite.
// Sets DATABASE_URL to the docker-compose test DB so no test ever touches Neon.
'use strict';

module.exports = async function globalSetup() {
  process.env.DATABASE_URL =
    'postgresql://testuser:testpassword@localhost:5433/aitasker_test';
  process.env.JWT_SECRET = 'test-jwt-secret-not-for-production';
  process.env.NODE_ENV   = 'test';
};