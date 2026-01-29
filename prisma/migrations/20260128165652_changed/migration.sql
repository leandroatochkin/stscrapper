/*
  Warnings:

  - You are about to drop the column `productName` on the `Price` table. All the data in the column will be lost.
  - You are about to drop the column `productQuery` on the `Price` table. All the data in the column will be lost.
  - Added the required column `product_name` to the `Price` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_query` to the `Price` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Price_productQuery_idx";

-- AlterTable
ALTER TABLE "Price" DROP COLUMN "productName",
DROP COLUMN "productQuery",
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_query" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Price_product_query_idx" ON "Price"("product_query");
