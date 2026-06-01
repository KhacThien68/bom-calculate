import {
  IsString,
  MinLength,
  Matches,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain both letters and numbers',
  })
  password!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'USER'])
  role?: Role;
}
