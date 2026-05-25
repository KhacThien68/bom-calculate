-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `material_code` VARCHAR(191) NOT NULL,
    `material_description` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `updated_by_user_id` INTEGER NOT NULL,

    UNIQUE INDEX `boms_material_code_key`(`material_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bom_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bom_id` INTEGER NOT NULL,
    `parent_id` INTEGER NULL,
    `component_code` VARCHAR(191) NOT NULL,
    `component_name` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `uom` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bom_items_bom_id_idx`(`bom_id`),
    INDEX `bom_items_parent_id_idx`(`parent_id`),
    INDEX `bom_items_bom_id_component_code_idx`(`bom_id`, `component_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `boms` ADD CONSTRAINT `boms_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boms` ADD CONSTRAINT `boms_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_bom_id_fkey` FOREIGN KEY (`bom_id`) REFERENCES `boms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `bom_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
