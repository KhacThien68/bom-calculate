import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MrpService } from './mrp.service';
import { MrpController } from './mrp.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MrpController],
  providers: [MrpService],
})
export class MrpModule {}
