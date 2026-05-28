import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MaterialsService } from './materials.service';
import { MaterialUploadService } from './material-upload.service';
import { MaterialPreviewCacheService } from './material-preview-cache.service';
import { MaterialsController } from './materials.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialUploadService, MaterialPreviewCacheService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
