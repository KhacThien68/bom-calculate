import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBomItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  componentName?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  uom?: string;

  @IsOptional()
  @IsNumber()
  actualStock?: number;

  @IsOptional()
  @IsNumber()
  standardStock?: number;
}
