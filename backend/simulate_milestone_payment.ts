import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Mirror backend's hmac-verifier signature generation
function signSepayPayload(rawBodyString: string, secret: string, timestamp: string) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBodyString}`)
    .digest('hex');
}

async function main() {
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET || "dev-secret-key-12345";
  
  // Allow passing a specific VA / Memo code and custom amount via CLI arguments:
  // e.g. npm run simulate:webhook WALLETTOPUPokhewqcV 10000000
  const targetVaNumber = process.argv[2]?.trim();
  const customAmount = process.argv[3] ? Number(process.argv[3]) : undefined;

  let va;
  if (targetVaNumber) {
    va = await prisma.virtualAccount.findFirst({
      where: { vaNumber: targetVaNumber }
    });
  } else {
    // Fetch the latest ACTIVE, unexpired virtual account created locally across ALL entity types (WALLET_TOPUP, MILESTONE, SERVICE, etc.)
    va = await prisma.virtualAccount.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: {
        expiresAt: 'desc'
      }
    });
  }

  if (!va || !va.vaNumber) {
    console.error("❌ No active, unexpired virtual account found in your local database.");
    console.error("👉 Make sure you clicked 'Pay Now', 'Top Up', or generated a payment QR in your browser first!");
    return;
  }

  const transferAmount = customAmount || (va.fixedAmount ? Number(va.fixedAmount) : 10000000);

  console.log(`Found active VA: ${va.vaNumber} (Type: ${va.entityType}) with amount: ${transferAmount} VND (linked to ID: ${va.entityId})`);

  // 2. Construct SePay webhook payload
  const payload = {
    gateway: "MBBank",
    transactionDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    accountNumber: "0394654576",
    subAccount: null,
    code: null,
    content: `${va.vaNumber} topup simulation`,
    transferType: "in",
    description: `BankAPINotify ${va.vaNumber} topup simulation`,
    transferAmount: transferAmount,
    referenceCode: `SIM-FT-${Date.now()}`,
    accumulated: 0,
    id: Math.floor(Math.random() * 10000000)
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signSepayPayload(rawBody, webhookSecret, timestamp);

  console.log("Sending simulated SePay IPN webhook callback to local backend (http://127.0.0.1:3001)...");
  
  try {
    const response = await axios.post("http://127.0.0.1:3001/webhooks/sepay/ipn", payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-sepay-signature': signature,
        'x-sepay-timestamp': timestamp,
      }
    });

    console.log("🟢 Response status:", response.status);
    console.log("🟢 Response data:", response.data);
    console.log("\n🎉 Webhook callback processed successfully! Your local browser page should now update automatically.");
  } catch (err: any) {
    console.error("❌ Local webhook call failed:");
    console.error(err.response?.data || err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
