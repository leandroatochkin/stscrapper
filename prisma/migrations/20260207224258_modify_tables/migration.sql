/*
  Warnings:

  - You are about to drop the column `pricePerUnit` on the `PriceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `brand` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `store` on the `Product` table. All the data in the column will be lost.
  - Added the required column `brandName` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PriceRecord_scrapedAt_idx";

-- AlterTable
ALTER TABLE "PriceRecord" DROP COLUMN "pricePerUnit",
ADD COLUMN     "discountPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "brand",
DROP COLUMN "store",
ADD COLUMN     "brandName" TEXT NOT NULL,
ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SearchTrend" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceRecord_productId_scrapedAt_idx" ON "PriceRecord"("productId", "scrapedAt");

-- CreateIndex
CREATE INDEX "Product_brandName_idx" ON "Product"("brandName");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "SearchTrend_query_city_idx" ON "SearchTrend"("query", "city");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
