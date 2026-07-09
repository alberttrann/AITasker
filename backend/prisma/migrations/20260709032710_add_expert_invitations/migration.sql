-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "expert_id" UUID NOT NULL,
    "ceo_id" UUID NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invitations_expert_id_idx" ON "invitations"("expert_id");

-- CreateIndex
CREATE INDEX "invitations_project_id_idx" ON "invitations"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_project_id_expert_id_key" ON "invitations"("project_id", "expert_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_ceo_id_fkey" FOREIGN KEY ("ceo_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
