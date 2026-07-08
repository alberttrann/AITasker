-- AlterTable
ALTER TABLE "elicitation_sessions" ADD COLUMN     "estimated_budget_vnd" BIGINT,
ADD COLUMN     "stage1_original_input" TEXT,
ADD COLUMN     "stage4_draft_json" JSONB;

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "estimated_cost_vnd" BIGINT,
ADD COLUMN     "estimated_duration_days" INTEGER,
ADD COLUMN     "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tech_stack_json" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "estimated_total_cost_vnd" BIGINT,
ADD COLUMN     "estimated_total_duration_days" INTEGER;

-- CreateTable
CREATE TABLE "domain_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seam_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seam_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archetype_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archetype_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "probe_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "archetype_code" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "probe_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_vnd" BIGINT NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_purchase_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "amount_paid_vnd" BIGINT NOT NULL,
    "purchased_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'WALLET',

    CONSTRAINT "subscription_purchase_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_definitions_code_key" ON "domain_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "seam_definitions_code_key" ON "seam_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "archetype_definitions_code_key" ON "archetype_definitions"("code");

-- CreateIndex
CREATE INDEX "probe_questions_archetype_code_idx" ON "probe_questions"("archetype_code");

-- CreateIndex
CREATE INDEX "subscription_purchase_logs_user_id_idx" ON "subscription_purchase_logs"("user_id");

-- AddForeignKey
ALTER TABLE "probe_questions" ADD CONSTRAINT "probe_questions_archetype_code_fkey" FOREIGN KEY ("archetype_code") REFERENCES "archetype_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_purchase_logs" ADD CONSTRAINT "subscription_purchase_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_purchase_logs" ADD CONSTRAINT "subscription_purchase_logs_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "subscription_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
