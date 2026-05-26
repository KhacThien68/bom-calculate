import { Module } from '@nestjs/common';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';
import { PreviewCacheService } from './preview-cache.service';

@Module({
  controllers: [BomController],
  providers: [BomService, PreviewCacheService],
})
export class BomModule {}
