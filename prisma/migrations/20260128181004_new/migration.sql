-- CreateTable
CREATE TABLE "ScrapeLock" (
    "id" SERIAL NOT NULL,
    "store" TEXT NOT NULL,
    "product_query" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeLock_store_product_query_key" ON "ScrapeLock"("store", "product_query");
