import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TrimString } from '../../../common/validators/ar-validators.decorators';

export class CreateZoneDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  province: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export interface ZoneAdminDto {
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
