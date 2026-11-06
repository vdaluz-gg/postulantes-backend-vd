import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SiteConfigVersion } from './entities/site-config-version.entity';
import { BackofficeSiteConfigController, SiteConfigController } from './site-config.controllers';
import { SiteConfigService } from './site-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([SiteConfigVersion]), AuthModule],
  controllers: [BackofficeSiteConfigController, SiteConfigController],
  providers: [SiteConfigService],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
