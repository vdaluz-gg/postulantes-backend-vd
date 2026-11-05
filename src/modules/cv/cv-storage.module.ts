import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/app-config.module';
import { AppEnv } from '../../config/env.validation';
import { LocalFileStorage } from './local-file-storage';
import { FILE_STORAGE } from './ports/file-storage';

/** Provee el almacenamiento de archivos. Para pasar a S3/Blob alcanza con cambiar el `useFactory`. */
@Global()
@Module({
  providers: [{ provide: FILE_STORAGE, inject: [APP_ENV], useFactory: (env: AppEnv) => new LocalFileStorage(env.UPLOAD_DIR) }],
  exports: [FILE_STORAGE],
})
export class CvStorageModule {}
