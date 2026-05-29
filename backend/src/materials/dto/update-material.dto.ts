import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @IsOptional() @IsString() @MinLength(1)
  uom?: string;

  @IsOptional() @IsNumber() @Min(0)
  actualStock?: number;

  @IsOptional() @IsNumber() @Min(0)
  standardStock?: number;

  @IsOptional() @IsNumber() @Min(0)
  moq?: number | null;
}
