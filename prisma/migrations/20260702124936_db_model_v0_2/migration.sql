/*
  Warnings:

  - A unique constraint covering the columns `[project_id,email,environment]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `environment` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `environment` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `environment` to the `PaymentMethod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `environment` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('live', 'test');

-- DropIndex
DROP INDEX "Customer_project_id_email_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "environment" "Environment" NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "environment" "Environment" NOT NULL,
ADD COLUMN     "payment_method_id" TEXT;

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "provider_response" JSONB;

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "environment" "Environment" NOT NULL;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "trial_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "environment" "Environment" NOT NULL,
ADD COLUMN     "trial_end" TIMESTAMP(3),
ADD COLUMN     "trial_start" TIMESTAMP(3),
ALTER COLUMN "current_period_start" DROP NOT NULL,
ALTER COLUMN "current_period_end" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_project_id_email_environment_key" ON "Customer"("project_id", "email", "environment");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
