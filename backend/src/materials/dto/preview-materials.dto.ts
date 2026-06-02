import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseType } from '../materials.types';

export class PreviewMaterialRowDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) uom!: string;
  @IsNumber() @Min(0) actualStock!: number;
  @IsNumber() @Min(0) standardStock!: number;
  @IsOptional() @IsNumber() @Min(0) moq?: number | null;
  @IsOptional() @IsEnum(['REQUIRED', 'NO', 'OPTIONAL']) purchaseType?:
    | PurchaseType
    | null;
}

export class PreviewMaterialsDto {
  @IsIn(['full', 'append']) mode!: 'full' | 'append';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreviewMaterialRowDto)
  items!: PreviewMaterialRowDto[];
}
