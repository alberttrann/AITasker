-- CreateTable
CREATE TABLE "milestone_chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "messages_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestone_chat_sessions_project_id_idx" ON "milestone_chat_sessions"("project_id");

-- CreateIndex
CREATE INDEX "milestone_chat_sessions_user_id_idx" ON "milestone_chat_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "milestone_chat_sessions" ADD CONSTRAINT "milestone_chat_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_chat_sessions" ADD CONSTRAINT "milestone_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
