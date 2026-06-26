#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
const noColor = args.includes('--no-color');
const urlFlagIndex = args.indexOf('--url');
const BASE_URL =
  urlFlagIndex !== -1 ? args[urlFlagIndex + 1] : `http://localhost:${process.env.PORT || 3001}`;

const scenarioFilter = args.find(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--url',
);

const C = noColor
  ? { green: (s) => s, red: (s) => s, yellow: (s) => s, cyan: (s) => s, bold: (s) => s, reset: '' }
  : {
      green:  (s) => `\x1b[32m${s}\x1b[0m`,
      red:    (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
      bold:   (s) => `\x1b[1m${s}\x1b[0m`,
    };

const SCENARIOS = [
  { name: 'auth',        file: './scenarios/s01_auth' },
  { name: 'wallet',      file: './scenarios/s02_wallet_and_webhook' },
  { name: 'elicitation', file: './scenarios/s03_elicitation_full_flow' },
  { name: 'milestones',  file: './scenarios/s04_milestones' },
];

async function main() {
  console.log(C.bold(`\n=== AITasker Backend — Live Endpoint Simulation ===`));
  console.log(`Target: ${C.cyan(BASE_URL)}\n`);

  // confirm env vars actually loaded 
  if (!process.env.SEPAY_WEBHOOK_SECRET) {
    console.log(C.yellow(`  ⚠ Warning: SEPAY_WEBHOOK_SECRET not found in environment.`));
    console.log(C.yellow(`    Expected .env at: ${require('path').join(__dirname, '..', '.env')}`));
  }
  if (!process.env.JWT_SECRET) {
    console.log(C.yellow(`  ⚠ Warning: JWT_SECRET not found in environment.\n`));
  }

  const toRun = scenarioFilter
    ? SCENARIOS.filter((s) => s.name === scenarioFilter)
    : SCENARIOS;

  if (scenarioFilter && toRun.length === 0) {
    console.log(C.red(`No scenario named "${scenarioFilter}". Available: ${SCENARIOS.map(s => s.name).join(', ')}`));
    process.exit(1);
  }

  let totalPass = 0, totalFail = 0, totalSkip = 0;
  const allResults = [];

  for (const scenario of toRun) {
    console.log(C.bold(`\n── ${scenario.name} ──────────────────────────────`));
    let results;
    try {
      const mod = require(scenario.file);
      results = await mod.run({ baseUrl: BASE_URL });
    } catch (err) {
      console.log(C.red(`  ✗ SCENARIO CRASHED: ${err.message}`));
      if (err.response) {
        console.log(C.red(`    HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`));
      }
      totalFail += 1;
      continue;
    }

    for (const r of results) {
      allResults.push({ scenario: scenario.name, ...r });
      if (r.status === 'PASS') {
        console.log(`  ${C.green('✓')} ${r.name}`);
        totalPass++;
      } else if (r.status === 'SKIP') {
        console.log(`  ${C.yellow('○')} ${r.name} ${C.yellow(`(SKIPPED: ${r.reason})`)}`);
        totalSkip++;
      } else {
        console.log(`  ${C.red('✗')} ${r.name}`);
        if (r.detail) console.log(`    ${C.red(r.detail)}`);
        totalFail++;
      }
    }
  }

  console.log(C.bold(`\n=== Summary ===`));
  console.log(`${C.green(`${totalPass} passed`)}, ${C.red(`${totalFail} failed`)}, ${C.yellow(`${totalSkip} skipped`)}\n`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(C.red(`Runner crashed: ${err.message}`));
  process.exit(1);
});