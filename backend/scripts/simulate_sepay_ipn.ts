import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables securely from .env file (never hardcode secrets in source code)
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Mirror backend's HmacVerifierService signature generation logic
function signSepayPayload(rawBodyString: string, secret: string, timestamp: string): string {
  return (
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBodyString}`)
      .digest('hex')
  );
}

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].replace(/^--/, '');
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      // DO NOT lowercase the value — VA numbers are case-sensitive!
      args[key] = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  // Read secret securely from process.env (SEPAY_WEBHOOK_SECRET or SEPAY_SECRET_KEY)
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET || process.env.SEPAY_SECRET_KEY;
  if (!webhookSecret) {
    console.error('❌ Error: SEPAY_WEBHOOK_SECRET or SEPAY_SECRET_KEY is not set in backend/.env');
    console.error('👉 Please configure SEPAY_WEBHOOK_SECRET in your local backend/.env file.');
    process.exit(1);
  }

  const backendUrl = process.env.BACKEND_URL || args.url || 'http://127.0.0.1:3001';

  let vaNumber: string | undefined = args.va;
  let rawContent: string | undefined = args.content;
  let amount: number | undefined = args.amount ? Number(args.amount) : undefined;
  const requestedType = args.type ? args.type.toUpperCase() : undefined; // 'SERVICE', 'MILESTONE', 'WALLET'

  if (rawContent) {
    const firstWord = rawContent.trim().split(/\s+/)[0];
    vaNumber = firstWord;
    console.log(`ℹ️  Using VA Number "${vaNumber}" from provided content string.`);
  }

  if (!vaNumber) {
    console.log('🔍 Searching local database for unexpired active Virtual Accounts...');

    const now = new Date();
    const whereClause: any = {
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    };

    if (requestedType === 'SERVICE') {
      whereClause.entityType = 'SERVICE';
    } else if (requestedType === 'MILESTONE') {
      whereClause.entityType = 'MILESTONE';
    } else if (requestedType === 'WALLET' || requestedType === 'USER') {
      whereClause.entityType = { in: ['USER', 'WALLET_TOPUP'] };
    }

    // Order by ID desc to get the most recently created Virtual Account!
    const activeVAs = await prisma.virtualAccount.findMany({
      where: whereClause,
      orderBy: { id: 'desc' },
      take: 10,
    });

    if (activeVAs.length === 0) {
      console.error(`❌ No unexpired ACTIVE VirtualAccount found in local database${requestedType ? ` for type "${requestedType}"` : ''}.`);
      console.error('👉 Tip: Generate a new payment QR code in your browser UI first!');
      console.error('👉 Or specify a exact VA: npm run simulate:ipn -- --content "SERVICEHBd4L4RI FT26201664040489 kC6CG8IG/877553"');
      process.exit(1);
    }

    console.log(`\n📋 Found ${activeVAs.length} active unexpired Virtual Account(s) in DB:`);
    activeVAs.forEach((item, idx) => {
      console.log(
        `   [${idx + 1}] VA: ${item.vaNumber.padEnd(22)} | Type: ${item.entityType.padEnd(10)} | Amount: ${item.fixedAmount ? `${item.fixedAmount} VND` : 'Custom'}`
      );
    });

    // Auto-select the newest unexpired VA (index 0)
    const selectedVA = activeVAs[0];
    vaNumber = selectedVA.vaNumber;
    if (!amount && selectedVA.fixedAmount) {
      amount = Number(selectedVA.fixedAmount);
    }
    console.log(`\n🎯 Auto-selected latest VA: "${vaNumber}" (Type: ${selectedVA.entityType})`);
  }

  // Fetch the chosen VA from DB to confirm fixedAmount if needed
  if (!amount) {
    const dbVa = await prisma.virtualAccount.findUnique({ where: { vaNumber } });
    if (dbVa && dbVa.fixedAmount) {
      amount = Number(dbVa.fixedAmount);
    }
  }

  const transferAmount = amount || 5000;
  const contentString = rawContent || `${vaNumber} FT26201664040489 kC6CG8IG/877553`;
  const referenceCode = args.ref || `SIM-FT-${Date.now()}`;
  const transactionDate = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const payload = {
    gateway: args.gateway || 'MBBank',
    transactionDate,
    accountNumber: args.account || '0394654576',
    subAccount: null,
    code: null,
    content: contentString,
    transferType: 'in',
    description: `BankAPINotify ${contentString}`,
    transferAmount,
    referenceCode,
    accumulated: 0,
    id: Math.floor(Math.random() * 100000000),
  };

  const rawBodyString = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signSepayPayload(rawBodyString, webhookSecret, timestamp);

  console.log(`\n🚀 Dispatching SePay IPN Webhook to ${backendUrl}/webhooks/sepay/ipn...`);
  console.log('📦 SePay Webhook Payload:');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(`${backendUrl}/webhooks/sepay/ipn`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-sepay-signature': signature,
        'x-sepay-timestamp': timestamp,
      },
    });

    console.log('\n🟢 Response Status:', response.status);
    console.log('🟢 Response Body:', response.data);
    console.log('\n🎉 SePay IPN Webhook processed successfully!');
    console.log('👉 Check your frontend browser window - your payment status should update automatically via Sockets!');
  } catch (err: any) {
    console.error('\n❌ Webhook request failed:');
    if (err.response) {
      console.error(`Status ${err.response.status}:`, err.response.data);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error executing simulation script:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
