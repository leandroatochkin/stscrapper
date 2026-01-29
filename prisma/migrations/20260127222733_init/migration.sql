-- CreateTable
CREATE TABLE "Price" (
    "id" SERIAL NOT NULL,
    "store" TEXT NOT NULL,
    "productQuery" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "url" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Price_store_idx" ON "Price"("store");

-- CreateIndex
CREATE INDEX "Price_productQuery_idx" ON "Price"("productQuery");
