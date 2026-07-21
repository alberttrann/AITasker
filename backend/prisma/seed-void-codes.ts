/// <reference types="node" />
/**
 * Seeds initial void code definitions into the DB.
 * Idempotent — uses upsert so re-running won't duplicate.
 *
 * Run: npx ts-node prisma/seed-void-codes.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const voidCodes = [
  { 
    code: 'NO_GROUND_TRUTH', 
    name: 'No Ground Truth', 
    severity: 'HIGH', 
    sortOrder: 1,
    description: 'No labelled data, evaluation benchmark, or success metric baseline mentioned. Risks building an AI system with no way to measure if it works.' 
  },
  { 
    code: 'NO_BASELINE', 
    name: 'No Baseline System', 
    severity: 'MEDIUM', 
    sortOrder: 2,
    description: 'No current system or manual process to compare against. Makes it impossible to quantify improvement from the AI solution.' 
  },
  { 
    code: 'UNCLEAR_SUCCESS_METRIC', 
    name: 'Unclear Success Metric', 
    severity: 'HIGH', 
    sortOrder: 3,
    description: 'Success criteria are vague or unmeasurable (e.g. "make it better"). Without measurable outcomes, milestone sign-off will be disputed.' 
  },
  { 
    code: 'DATA_PRIVACY_CONSTRAINT', 
    name: 'Data Privacy Constraint', 
    severity: 'HIGH', 
    sortOrder: 4,
    description: 'Sensitive data (personal, financial, health, legal) involved with unclear compliance requirements. May block data access or require costly anonymisation.' 
  },
  { 
    code: 'INTEGRATION_UNCLEAR', 
    name: 'Integration Unclear', 
    severity: 'MEDIUM', 
    sortOrder: 5,
    description: 'How the AI system will connect to existing tools, databases, or workflows has not been described. Increases integration risk and hidden scope.' 
  },
  { 
    code: 'TIMELINE_UNREALISTIC', 
    name: 'Unrealistic Timeline', 
    severity: 'MEDIUM', 
    sortOrder: 6,
    description: 'The requested delivery timeline appears too aggressive for the described scope. Risks quality shortcuts and budget overruns.' 
  },
  { 
    code: 'SCOPE_CREEP_RISK', 
    name: 'Scope Creep Risk', 
    severity: 'MEDIUM', 
    sortOrder: 7,
    description: 'Too many objectives described for a single engagement. Diffuse scope reduces quality and makes milestone definition difficult.' 
  },
  { 
    code: 'MISSING_TECHNICAL_ARTIFACT', 
    name: 'Missing Technical Artifact', 
    severity: 'HIGH', 
    sortOrder: 8,
    description: 'A critical technical document (ruleset, schema, API spec, dataset) was mentioned but not yet provided. Synthesis cannot be faithfully grounded without it.' 
  },
];

async function main() {
  console.log('Starting void code definitions seed...\n');

  for (const v of voidCodes) {
    await prisma.voidCodeDefinition.upsert({
      where: { code: v.code },
      create: v,
      update: { 
        name: v.name, 
        description: v.description, 
        severity: v.severity, 
        sortOrder: v.sortOrder 
      },
    });

    console.log(` Seeded void code: ${v.code}`);
  }

  console.log('\n Void codes seed complete.');
}

main()
  .catch((e) => {
    console.error(' Seeding failed with error:');
    console.error(e);
    throw e; // Safely exit without 'process' global type issues
  })
  .finally(() => prisma.$disconnect());