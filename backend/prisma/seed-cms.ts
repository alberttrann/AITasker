/**
 * Seed script — populates CMS config tables from values previously hardcoded
 * in elicitation.service.ts and stage5_synthesize.txt prompt.
 *
 * Run: npx ts-node prisma/seed-cms.ts
 *
 * Safe to run multiple times — uses upsert so re-runs are idempotent.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // ── Domain Definitions (from stage5_synthesize.txt DOMAIN CODES) ─────────
  const domains = [
    { code: 'A', name: 'LLM App Engineering',         sortOrder: 1 },
    { code: 'B', name: 'MLOps/LLMOps',                sortOrder: 2 },
    { code: 'C', name: 'AI Eval & Quality',            sortOrder: 3 },
    { code: 'D', name: 'Vector DB & Embeddings',       sortOrder: 4 },
    { code: 'E', name: 'Data & Pipeline Engineering',  sortOrder: 5 },
    { code: 'F', name: 'ML Modeling & Fine-Tuning',    sortOrder: 6 },
  ];
  for (const d of domains) {
    await prisma.domainDefinition.upsert({
      where: { code: d.code },
      create: d,
      update: { name: d.name, sortOrder: d.sortOrder },
    });
  }
  console.log('Domain definitions seeded');

  // ── Seam Definitions (from stage5_synthesize.txt SEAM CODES) ─────────────
  const seams = [
    { code: 'A↔C', name: 'LLM output quality',          sortOrder: 1 },
    { code: 'A↔F', name: 'Fine-tuned model integration', sortOrder: 2 },
    { code: 'A↔D', name: 'Retrieval-generation',         sortOrder: 3 },
    { code: 'D↔E', name: 'Embedding pipeline',           sortOrder: 4 },
    { code: 'D↔F', name: 'Model-vector alignment',       sortOrder: 5 },
    { code: 'C↔F', name: 'Eval-model feedback',          sortOrder: 6 },
    { code: 'E↔F', name: 'Training data',                sortOrder: 7 },
    { code: 'A↔B', name: 'Deployment-inference',         sortOrder: 8 },
    { code: 'B↔E', name: 'Monitoring-pipeline',          sortOrder: 9 },
    { code: 'C↔E', name: 'Ground-truth pipeline',        sortOrder: 10 },
  ];
  for (const s of seams) {
    await prisma.seamDefinition.upsert({
      where: { code: s.code },
      create: s,
      update: { name: s.name, sortOrder: s.sortOrder },
    });
  }
  console.log('Seam definitions seeded');

  // ── Archetype Definitions (from ARCHETYPE_PROBE_QUESTIONS keys) ───────────
  const archetypes = [
    { code: '1', name: 'RAG/Search',               description: 'Chatbots, knowledge base Q&A, document retrieval', sortOrder: 1 },
    { code: '2', name: 'Recommendation',           description: 'Product/content/user recommendation engines',       sortOrder: 2 },
    { code: '3', name: 'Classification',           description: 'Fraud detection, sentiment analysis, categorisation', sortOrder: 3 },
    { code: '4', name: 'Generation',               description: 'Content/code/creative generation',                  sortOrder: 4 },
    { code: '5', name: 'Prediction/Forecasting',   description: 'Churn prediction, demand forecasting, time-series', sortOrder: 5 },
    { code: '6', name: 'Multimodal',               description: 'Vision+language, audio+text, cross-modal AI',       sortOrder: 6 },
  ];
  for (const a of archetypes) {
    await prisma.archetypeDefinition.upsert({
      where: { code: a.code },
      create: a,
      update: { name: a.name, description: a.description, sortOrder: a.sortOrder },
    });
  }
  console.log('Archetype definitions seeded');

  // ── Probe Questions (from ARCHETYPE_PROBE_QUESTIONS constant) ────────────
  const probeQuestions: { archetypeCode: string; questionText: string; displayOrder: number }[] = [
    // Archetype 1 — RAG/Search
    { archetypeCode: '1', displayOrder: 1, questionText: 'Roughly how many people will search or ask questions per day?' },
    { archetypeCode: '1', displayOrder: 2, questionText: 'When someone gets a wrong or unhelpful answer, what do you expect to happen next?' },
    { archetypeCode: '1', displayOrder: 3, questionText: 'Does this need to pull from documents/systems you already have, and which ones?' },
    { archetypeCode: '1', displayOrder: 4, questionText: 'How quickly does an answer need to appear after someone asks?' },
    // Archetype 2 — Recommendation
    { archetypeCode: '2', displayOrder: 1, questionText: 'Roughly how many users will see recommendations, and how often?' },
    { archetypeCode: '2', displayOrder: 2, questionText: 'What should happen if someone ignores or dislikes a recommendation?' },
    { archetypeCode: '2', displayOrder: 3, questionText: 'Where do you already track what users like/buy/view — any existing system?' },
    { archetypeCode: '2', displayOrder: 4, questionText: 'How fresh do recommendations need to be (instant, hourly, daily)?' },
    // Archetype 3 — Classification
    { archetypeCode: '3', displayOrder: 1, questionText: 'Roughly how many items need classifying per day?' },
    { archetypeCode: '3', displayOrder: 2, questionText: 'What should happen when the system isn\'t confident about a classification?' },
    { archetypeCode: '3', displayOrder: 3, questionText: 'Where does the data to classify come from today — any existing system?' },
    { archetypeCode: '3', displayOrder: 4, questionText: 'How quickly does a classification decision need to be made?' },
    // Archetype 4 — Generation
    { archetypeCode: '4', displayOrder: 1, questionText: 'Roughly how much content needs generating per day/week?' },
    { archetypeCode: '4', displayOrder: 2, questionText: 'What happens if generated content is wrong or inappropriate — who reviews it?' },
    { archetypeCode: '4', displayOrder: 3, questionText: 'Does generated content need to match an existing brand voice/system/template?' },
    { archetypeCode: '4', displayOrder: 4, questionText: 'How long can someone wait for content to be generated?' },
    // Archetype 5 — Prediction/Forecasting
    { archetypeCode: '5', displayOrder: 1, questionText: 'How far ahead are you trying to predict, and how often do you need a new prediction?' },
    { archetypeCode: '5', displayOrder: 2, questionText: 'What happens today when a prediction turns out wrong?' },
    { archetypeCode: '5', displayOrder: 3, questionText: 'What historical data do you already have to learn from?' },
    { archetypeCode: '5', displayOrder: 4, questionText: 'How quickly after new data arrives do you need an updated prediction?' },
    // Archetype 6 — Multimodal
    { archetypeCode: '6', displayOrder: 1, questionText: 'Roughly how many items (images/audio/video) need processing per day?' },
    { archetypeCode: '6', displayOrder: 2, questionText: 'What should happen when the system can\'t confidently interpret an input?' },
    { archetypeCode: '6', displayOrder: 3, questionText: 'Where does this input data come from today — any existing system?' },
    { archetypeCode: '6', displayOrder: 4, questionText: 'How quickly does processing need to complete after input arrives?' },
  ];

  // Delete all existing questions first (idempotent re-seed)
  await prisma.probeQuestion.deleteMany({});
  await prisma.probeQuestion.createMany({ data: probeQuestions });
  console.log(`${probeQuestions.length} probe questions seeded`);

  // ── Subscription Packages (from SubscriptionPrice enum + hardcoded 6 months) ─
  const packages = [
    { role: 'CLIENT', name: 'Client Pro', priceVnd: 500000n, durationMonths: 6 },
    { role: 'EXPERT', name: 'Expert Pro', priceVnd: 300000n, durationMonths: 6 },
  ];
  for (const pkg of packages) {
    const existing = await prisma.subscriptionPackage.findFirst({
      where: { role: pkg.role, isActive: true },
    });
    if (!existing) {
      await prisma.subscriptionPackage.create({ data: pkg });
      console.log(` Subscription package created: ${pkg.name}`);
    } else {
      console.log(` Subscription package already exists for role=${pkg.role}, skipping`);
    }
  }

  console.log('\n Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());