import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayloadUser,
} from '../common/decorators/current-user.decorator';
import { MaterialsService } from './materials.service';
import { MaterialUploadService } from './material-upload.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { PreviewMaterialsDto } from './dto/preview-materials.dto';
import { CommitMaterialsDto } from './dto/commit-materials.dto';

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(
    private materials: MaterialsService,
    private upload: MaterialUploadService,
  ) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.materials.list({
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('search')
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.materials.search(q ?? '', limit ? parseInt(limit, 10) : 20);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.materials.getById(id);
  }

  @Post()
  create(@Body() dto: CreateMaterialDto, @CurrentUser() u: JwtPayloadUser) {
    return this.materials.create(dto, u.sub);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaterialDto,
    @CurrentUser() u: JwtPayloadUser,
  ) {
    return this.materials.update(id, dto, u.sub);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.materials.delete(id);
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewMaterialsDto) {
    return this.upload.preview(dto);
  }

  @Post('commit')
  @HttpCode(200)
  commit(@Body() dto: CommitMaterialsDto, @CurrentUser() u: JwtPayloadUser) {
    return this.upload.commit(dto.previewToken, u.sub);
  }
}
