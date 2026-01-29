/*
  Warnings:

  - Added the required column `brand` to the `Price` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Price" ADD COLUMN     "brand" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Price_brand_idx" ON "Price"("brand");
