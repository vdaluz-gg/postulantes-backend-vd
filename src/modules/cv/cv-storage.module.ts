import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/app-config.module';
import { createFileStorage } from './file-storage.factory';
import { FILE_STORAGE } from './ports/file-storage';

/** Provee el almacenamiento de archivos (ver createFileStorage). Para pasar a S3/Blob se cambia la fábrica. */
@Global()
@Module({
  providers: [{ provide: FILE_STORAGE, inject: [APP_ENV], useFactory: createFileStorage }],
  exports: [FILE_STORAGE],
})
export class CvStorageModule {}
