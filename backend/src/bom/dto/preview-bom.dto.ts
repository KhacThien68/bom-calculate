import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewItemDto {
  @IsInt()
  @Min(1)
  level!: number;

  @IsString()
  @MinLength(1)
  componentCode!: string;

  @IsString()
  @MinLength(1)
  componentName!: string;

  @IsNumber()
  quantity!: number;

  @IsString()
  @MinLength(1)
  uom!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsInt()
  parentSortOrder!: number | null;
}

export class PreviewBomDto {
  @IsString()
  @MinLength(1)
  materialCode!: string;

  @IsString()
  @MinLength(1)
  materialDescription!: string;

  @IsIn(['full', 'append'])
  mode!: 'full' | 'append';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewItemDto)
  items!: PreviewItemDto[];
}
