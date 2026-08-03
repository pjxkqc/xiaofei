-- These composite keys are required by the Email mirror relations. Preview and
-- UAT databases can already contain the tables before this schema revision, so
-- Prisma correctly refuses to add them through an unattended `db push`.
--
-- Add only the known, lossless indexes here. PostgreSQL itself fails the build
-- if duplicate rows exist; no rows are deleted or rewritten. New databases skip
-- the blocks and let the normal Prisma push create the complete schema.
DO $$
BEGIN
  IF to_regclass('public.xiaofei_conversation') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "xiaofei_conversation_workspaceId_id_key"
      ON "xiaofei_conversation"("workspaceId", "id");
  END IF;

  IF to_regclass('public.xiaofei_conversation_message') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "xiaofei_conversation_message_workspaceId_eventId_key"
      ON "xiaofei_conversation_message"("workspaceId", "eventId");
    CREATE UNIQUE INDEX IF NOT EXISTS "xiaofei_conversation_message_workspaceId_inboundEventId_key"
      ON "xiaofei_conversation_message"("workspaceId", "inboundEventId");
    CREATE UNIQUE INDEX IF NOT EXISTS "xiaofei_conversation_message_workspaceId_id_key"
      ON "xiaofei_conversation_message"("workspaceId", "id");
  END IF;

  IF to_regclass('public.xiaofei_processing_job') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "xiaofei_processing_job_workspaceId_conversationMessageId_key"
      ON "xiaofei_processing_job"("workspaceId", "conversationMessageId");
    CREATE UNIQUE INDEX IF NOT EXISTS "xiaofei_processing_job_workspaceId_id_key"
      ON "xiaofei_processing_job"("workspaceId", "id");
  END IF;
END
$$;
