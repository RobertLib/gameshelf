-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "generation" INTEGER,
    "releaseYear" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortTitle" TEXT NOT NULL,
    "searchIndex" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "releaseYear" INTEGER,
    "developer" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "barcode" TEXT,
    "region" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "conditionRank" INTEGER NOT NULL,
    "completeness" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "coverImageUrl" TEXT,
    "purchasePriceMinor" INTEGER,
    "estimatedValueMinor" INTEGER,
    "purchaseCurrency" TEXT NOT NULL DEFAULT 'CZK',
    "purchaseDate" TEXT,
    "purchasedFrom" TEXT,
    "storageLocation" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "games_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_GameGenres" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GameGenres_A_fkey" FOREIGN KEY ("A") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GameGenres_B_fkey" FOREIGN KEY ("B") REFERENCES "genres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE INDEX "platforms_sortOrder_idx" ON "platforms"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE INDEX "games_userId_sortTitle_idx" ON "games"("userId", "sortTitle");

-- CreateIndex
CREATE INDEX "games_userId_releaseYear_idx" ON "games"("userId", "releaseYear");

-- CreateIndex
CREATE INDEX "games_userId_createdAt_idx" ON "games"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "games_userId_updatedAt_idx" ON "games"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "games_userId_rating_idx" ON "games"("userId", "rating");

-- CreateIndex
CREATE INDEX "games_userId_platformId_idx" ON "games"("userId", "platformId");

-- CreateIndex
CREATE INDEX "games_userId_status_idx" ON "games"("userId", "status");

-- CreateIndex
CREATE INDEX "games_userId_isFavorite_idx" ON "games"("userId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "_GameGenres_AB_unique" ON "_GameGenres"("A", "B");

-- CreateIndex
CREATE INDEX "_GameGenres_B_index" ON "_GameGenres"("B");
