import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateMaterialDto {
  @IsString() @MinLength(1)
  code!: string;

  @IsString() @MinLength(1)
  name!: string;

  @IsString() @MinLength(1)
  uom!: string;

  @IsNumber() @Min(0)
  actualStock!: number;

  @IsNumber() @Min(0)
  standardStock!: number;

  @IsOptional() @IsNumber() @Min(0)
  moq?: number | null;
}
