/*
  Warnings:

  - You are about to drop the column `is_active` on the `WebhookEndpoint` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[project_id,environment]` on the table `WebhookEndpoint` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `environment` to the `WebhookEndpoint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `WebhookEndpoint` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WebhookEndpoint" DROP COLUMN "is_active",
ADD COLUMN     "environment" "Environment" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEndpoint_project_id_environment_key" ON "WebhookEndpoint"("project_id", "environment");
