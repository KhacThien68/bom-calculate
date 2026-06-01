import { IsString, MinLength } from 'class-validator';

export class CommitMaterialsDto {
  @IsString()
  @MinLength(1)
  previewToken!: string;
}
