-- CreateTable
CREATE TABLE `materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `uom` VARCHAR(191) NOT NULL,
    `actual_stock` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `standard_stock` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `moq` DECIMAL(18, 6) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `updated_by_user_id` INTEGER NOT NULL,

    UNIQUE INDEX `materials_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
