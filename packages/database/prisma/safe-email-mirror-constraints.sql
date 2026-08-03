-- These compatibility steps are required by the final Email mirror relations.
-- A disposable Preview can already contain the first revision of these tables,
-- so Prisma correctly refuses to finish them through an unattended `db push`.
--
-- Add only the known, lossless column backfill and indexes here. PostgreSQL
-- fails the build if rows cannot be mapped or unique; no rows are deleted.
-- New databases skip the blocks and let Prisma create the complete schema.
DO $$
BEGIN
  IF to_regclass('public.xiaofei_conversation') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "xiaofei_conversation_workspaceId_id_key"
      ON "xiaofei_conversation"("workspaceId", "id");
  END IF;

  IF to_regclass('public.xiaofei_conversation_message') IS NOT NULL THEN
    -- The first mirror Preview briefly deployed the original message table
    -- before eventId was added to the final contract. Recover that column from
    -- the durable inbound-event ledger; fail closed if an orphan prevents a
    -- complete backfill.
    ALTER TABLE "xiaofei_conversation_message"
      ADD COLUMN IF NOT EXISTS "eventId" TEXT;
    UPDATE "xiaofei_conversation_message" AS message
      SET "eventId" = event."eventId"
      FROM "xiaofei_inbound_event" AS event
      WHERE message."eventId" IS NULL
        AND message."workspaceId" = event."workspaceId"
        AND message."inboundEventId" = event."id";
    IF EXISTS (
      SELECT 1
      FROM "xiaofei_conversation_message"
      WHERE "eventId" IS NULL
    ) THEN
      RAISE EXCEPTION 'Email mirror eventId backfill found an orphan message';
    END IF;
    ALTER TABLE "xiaofei_conversation_message"
      ALTER COLUMN "eventId" SET NOT NULL;

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
