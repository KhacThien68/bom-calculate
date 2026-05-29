import { Module } from '@nestjs/common';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';
import { PreviewCacheService } from './preview-cache.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MaterialsModule } from '../materials/materials.module';

@Module({
  imports: [PrismaModule, MaterialsModule],
  controllers: [BomController],
  providers: [BomService, PreviewCacheService],
})
export class BomModule {}
