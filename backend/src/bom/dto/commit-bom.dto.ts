import { IsString, IsUUID } from 'class-validator';

export class CommitBomDto {
  @IsString()
  @IsUUID()
  previewToken!: string;
}
