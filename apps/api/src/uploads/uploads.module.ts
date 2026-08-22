import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from '@gameshelf/contracts';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AppErrors } from '../common/errors';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

/** Extension based on the declared type - the original file name is ignored. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
};

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        storage: diskStorage({
          destination: config.uploadsDir,
          /**
           * We generate the name ourselves. Using the one from the client would
           * open the door both to `../../etc/passwd` and to overwriting somebody
           * else's file.
           */
          filename: (_req, file, callback) => {
            callback(
              null,
              `${randomUUID()}${EXTENSIONS[file.mimetype] ?? '.bin'}`,
            );
          },
        }),
        limits: {
          fileSize: MAX_UPLOAD_BYTES,
          files: 1,
        },
        fileFilter: (_req, file, callback) => {
          const accepted = (
            ACCEPTED_IMAGE_MIME_TYPES as readonly string[]
          ).includes(file.mimetype);
          callback(
            accepted
              ? null
              : AppErrors.uploadRejected(
                  `Unsupported format ${file.mimetype}. Allowed: JPEG, PNG, WebP, AVIF, GIF.`,
                ),
            accepted,
          );
        },
      }),
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
