-- Drop stock columns from bom_items (moved to materials)
ALTER TABLE `bom_items` DROP COLUMN `actual_stock`;
ALTER TABLE `bom_items` DROP COLUMN `standard_stock`;
