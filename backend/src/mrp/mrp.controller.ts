import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MrpService } from './mrp.service';
import { CalculateMrpDto } from './dto/calculate-mrp.dto';

@Controller('mrp')
@UseGuards(JwtAuthGuard)
export class MrpController {
  constructor(private mrp: MrpService) {}

  @Post('calculate')
  @HttpCode(200)
  calculate(@Body() dto: CalculateMrpDto) {
    return this.mrp.calculate(dto);
  }
}
