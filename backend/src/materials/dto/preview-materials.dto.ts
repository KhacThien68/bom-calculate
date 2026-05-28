import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewMaterialRowDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) uom!: string;
  @IsNumber() @Min(0) actualStock!: number;
  @IsNumber() @Min(0) standardStock!: number;
  @IsOptional() @IsNumber() @Min(0) moq?: number | null;
}

export class PreviewMaterialsDto {
  @IsIn(['full', 'append']) mode!: 'full' | 'append';

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreviewMaterialRowDto)
  items!: PreviewMaterialRowDto[];
}
