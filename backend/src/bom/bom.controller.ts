import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayloadUser } from '../common/decorators/current-user.decorator';
import { BomService } from './bom.service';
import { PreviewBomDto } from './dto/preview-bom.dto';
import { CommitBomDto } from './dto/commit-bom.dto';

@Controller('bom')
@UseGuards(JwtAuthGuard)
export class BomController {
  constructor(private bom: BomService) {}

  @Get()
  list() {
    return this.bom.list();
  }

  @Get(':materialCode')
  getOne(@Param('materialCode') materialCode: string) {
    return this.bom.getTree(materialCode);
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewBomDto) {
    return this.bom.preview(dto);
  }

  @Post('commit')
  @HttpCode(200)
  commit(@Body() dto: CommitBomDto, @CurrentUser() user: JwtPayloadUser) {
    return this.bom.commit(dto.previewToken, user.sub);
  }
}
