import { Controller, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { contract, UPLOAD_FIELD_NAME, type Output } from '@gameshelf/contracts';
import { Endpoint } from '../common/http/endpoint.decorator';
import { ThrottleUpload } from '../common/http/throttling';
import { AppErrors } from '../common/errors';
import { UploadsService } from './uploads.service';

@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Uploading is more expensive than an ordinary request, hence its own stricter limit. */
  @ThrottleUpload()
  @Endpoint(contract.uploads.cover)
  @UseInterceptors(FileInterceptor(UPLOAD_FIELD_NAME))
  async uploadCover(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<Output<typeof contract.uploads.cover>> {
    if (!file) {
      throw AppErrors.uploadRejected(
        `Missing file in the "${UPLOAD_FIELD_NAME}" field.`,
      );
    }
    return this.uploads.finalize(file);
  }
}
