-- CreateIndex
CREATE INDEX "games_userId_purchasePriceMinor_idx" ON "games"("userId", "purchasePriceMinor");

-- CreateIndex
CREATE INDEX "games_userId_conditionRank_idx" ON "games"("userId", "conditionRank");
