// Runs once after the entire test suite.
'use strict';

module.exports = async function globalTeardown() {
  // Nothing to do — docker compose down wipes the tmpfs DB.
  // Add cleanup logic here if later add shared resources (e.g. Redis).
};