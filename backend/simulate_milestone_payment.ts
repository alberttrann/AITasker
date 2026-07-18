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
  const webhookSecret = "whsec_w3djV5C6NeaB5Ypwc7LWeBYlIPK2m0SW"; // from local .env
  
  // 1. Fetch the latest active virtual account created locally for a MILESTONE or SERVICE
  const va = await prisma.virtualAccount.findFirst({
    where: {
      entityType: { in: ["MILESTONE", "SERVICE"] },
      status: "ACTIVE"
    },
    orderBy: {
      expiresAt: 'desc'
    }
  });

  if (!va || !va.vaNumber) {
    console.error("❌ No ACTIVE virtual account found for any milestone or service on your LOCAL database.");
    console.error("👉 Make sure you clicked 'Generate Payment Info' or 'Pay Now' on your browser page first!");
    return;
  }

  console.log(`Found active VA: ${va.vaNumber} (Type: ${va.entityType}) with amount: ${va.fixedAmount} VND (linked to ID: ${va.entityId})`);

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
    transferAmount: Number(va.fixedAmount || 2000),
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
