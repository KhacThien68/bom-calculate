import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MrpOrderDto {
  @IsString() @MinLength(1) code!: string;
  @IsNumber() @Min(0) qty!: number;
  @IsOptional() @IsNumber() @Min(0) commercialQty?: number;
}

export class MrpOverrideDto {
  @IsString() @MinLength(1) code!: string;
  @IsInt() @Min(1) level!: number;
  @IsNumber() @Min(0) commercialQty!: number;
}

export class CalculateMrpDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MrpOrderDto)
  orders!: MrpOrderDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MrpOverrideDto)
  commercialOverrides?: MrpOverrideDto[];
}
