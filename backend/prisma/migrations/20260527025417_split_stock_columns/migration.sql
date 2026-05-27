/*
  Warnings:

  - You are about to drop the column `stock` on the `bom_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `bom_items` DROP COLUMN `stock`,
    ADD COLUMN `actual_stock` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN `standard_stock` DECIMAL(18, 6) NOT NULL DEFAULT 0;
