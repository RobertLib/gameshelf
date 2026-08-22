-- Absolute cap on the lifetime of a refresh token family (one session).
--
-- Nullable on purpose: sessions issued before this migration have no cap
-- recorded and would have nothing sensible to backfill it with. They get one on
-- their next rotation (see RefreshTokenService.rotate), so nobody is signed out
-- by the deployment.

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "familyExpiresAt" DATETIME;
