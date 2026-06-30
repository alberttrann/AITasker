const http = require('http');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node health-check.js <url>');
  process.exit(2);
}

const req = http.get(url, { timeout: 5000 }, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(`OK ${res.statusCode}: ${body}`);
      process.exit(0);
    } else {
      console.error(`FAIL ${res.statusCode}: ${body}`);
      process.exit(1);
    }
  });
});

req.on('timeout', () => {
  console.error('FAIL: request timed out');
  req.destroy();
  process.exit(1);
});

req.on('error', (err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});