/// <reference types="node" />
/**
 * Seeds initial prompt templates from .txt files into the DB.
 * Idempotent — uses upsert so re-running won't duplicate.
 *
 * Run: npx ts-node prisma/seed-prompts.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'ai-service', 'app', 'prompts');

const stages = [
  // ── Elicitation Flow (D-1, D-3, D-4, E-2) ────────────────────────────────
  { stage: 'stage1_extract',        description: 'Stage 1 — symptom extraction, archetype recommendation, critical artifact detection' },
  { stage: 'stage3_vagueness_check', description: 'Stage 3 — probe answer vagueness + relevancy check' },
  { stage: 'stage4_recommend',       description: 'Stage 4 — tech stack recommendation for non-technical CEO' },
  { stage: 'stage5_synthesize',      description: 'Stage 5 — full project specification synthesis' },

  // ── Core Workspace Features (E-3, Remaining patches) ────────────────────
  { stage: 'milestone_chat',         description: 'E-3 — context-aware milestone editing assistant' },
  { stage: 'criterion_check',        description: 'Acceptance Criteria — subjective language advisor' },
  { stage: 'dispute_eval',           description: 'Disputes — neutral AI arbitration' },
  { stage: 'portfolio_eval',         description: 'Expert Portfolio — Tier 2 seam boundary evaluator' },
  { stage: 'service_generate',       description: 'Marketplace — expert service listing generator' },
];

async function main() {
  console.log('Starting prompt templates seed...\n');

  for (const { stage, description } of stages) {
    const filePath = path.join(PROMPTS_DIR, `${stage}.txt`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ File not found: ${filePath} — skipping`);
      continue;
    }

    const templateText = fs.readFileSync(filePath, 'utf-8').trim();

    await prisma.promptTemplate.upsert({
      where: { stage },
      create: { 
        stage, 
        templateText, 
        description 
      },
      update: { 
        templateText, 
        description 
      },
    });

    console.log(` Seeded prompt template: ${stage}`);
  }

  console.log('\n Prompt templates seed complete.');
}

main()
  .catch((e) => {
    console.error(' Seeding failed with error:');
    console.error(e);
    throw e; 
  })
  .finally(() => prisma.$disconnect());