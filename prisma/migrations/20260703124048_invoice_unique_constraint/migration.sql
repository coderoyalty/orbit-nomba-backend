/*
  Warnings:

  - A unique constraint covering the columns `[subscription_id,period_start]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `period_end` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period_start` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "period_end" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "period_start" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ProjectApiKey" ADD COLUMN     "secret_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_subscription_id_period_start_key" ON "Invoice"("subscription_id", "period_start");
