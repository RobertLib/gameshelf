import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { open, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  type UploadResult,
} from '@gameshelf/contracts';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AppErrors } from '../common/errors';

/** The public path the uploaded files are served under. */
export const UPLOADS_PUBLIC_PATH = '/uploads';

/**
 * How long after the upload a file may exist without anything pointing at it.
 *
 * The user uploads a cover and saves the form only a moment later - if the
 * cleanup treated "unreferenced" as "to be deleted", it would snatch the image
 * from under their hands. A day is a safe margin even for work in progress.
 */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Signatures (magic bytes) of the allowed formats.
 *
 * Checking only the `Content-Type` of the request is not enough - the client
 * fills that header in as it pleases. Without this check an HTML file could be
 * uploaded under an `image/png` header, giving us stored XSS on our own domain.
 */
const MAGIC_BYTES: ReadonlyArray<{
  mimeType: (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];
  test: (head: Buffer) => boolean;
}> = [
  {
    mimeType: 'image/jpeg',
    test: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    test: (h) =>
      h.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mimeType: 'image/gif',
    test: (h) => h.subarray(0, 6).toString('ascii').startsWith('GIF8'),
  },
  {
    mimeType: 'image/webp',
    test: (h) =>
      h.subarray(0, 4).toString('ascii') === 'RIFF' &&
      h.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mimeType: 'image/avif',
    // ISO-BMFF: 4 length bytes, then 'ftyp' and the brand "avif" / "avis".
    test: (h) =>
      h.subarray(4, 8).toString('ascii') === 'ftyp' &&
      ['avif', 'avis', 'mif1'].includes(h.subarray(8, 12).toString('ascii')),
  },
];

/**
 * Storage for uploaded images. It can accept, validate, delete and clean up
 * files.
 *
 * It knows nothing about the domain - on purpose. As long as this service asked
 * the database itself how many `game` records point at a given file, the
 * "uploads" module knew the "games" module even though the dependency in
 * `@Module` runs the other way. Who owns a cover is decided by
 * `CoverCleanupService` on the collection side; a finished list of addresses and
 * names is what arrives here.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * The storage has to exist before multer tries to write the first file. It is
   * in `onModuleInit`, not in the application bootstrap, so that it cannot be
   * forgotten with a different way of starting up (in the tests, for instance).
   */
  async onModuleInit(): Promise<void> {
    await mkdir(this.config.uploadsDir, { recursive: true });
    this.logger.log(`Image storage: ${this.config.uploadsDir}`);
  }

  /**
   * Validates the actual contents of the written file and returns the address for
   * `coverImageUrl`. If the contents do not match the declared type, the file is
   * deleted.
   */
  async finalize(file: Express.Multer.File): Promise<UploadResult> {
    const path = join(this.config.uploadsDir, file.filename);

    const detected = await this.detectMimeType(path);
    if (!detected || detected !== file.mimetype) {
      await this.discard(path);
      throw AppErrors.uploadRejected(
        'The file is not a valid image in a supported format (JPEG, PNG, WebP, AVIF, GIF).',
      );
    }

    const { size } = await stat(path);

    return {
      url: `${UPLOADS_PUBLIC_PATH}/${file.filename}`,
      fileName: file.filename,
      sizeBytes: size,
      mimeType: detected,
    };
  }

  /**
   * Deletes a file from our storage. External links (http/https) are ignored -
   * they are not ours.
   *
   * Whether anything still points at the file is not decided here; that is a
   * domain question and the caller answers it.
   */
  async remove(url: string | null | undefined): Promise<void> {
    const fileName = localFileName(url);
    if (!fileName) return;

    await this.discard(join(this.config.uploadsDir, fileName));
  }

  /**
   * Deletes files nothing points at.
   *
   * A safety net for the cases that targeted releasing does not catch: an upload
   * without saving the form, a failed request, a restored database backup.
   *
   * @param referenced names of the files somebody holds. The storage has no way
   *   of finding out who uses the covers - and is not supposed to know either.
   */
  async purgeOrphans(referenced: ReadonlySet<string>): Promise<number> {
    const files = await readdir(this.config.uploadsDir).catch(
      () => [] as string[],
    );

    const deadline = Date.now() - ORPHAN_GRACE_MS;
    let removed = 0;

    for (const file of files) {
      if (referenced.has(file)) continue;

      const path = join(this.config.uploadsDir, file);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile() || info.mtimeMs > deadline) continue;

      await this.discard(path);
      removed += 1;
    }

    if (removed > 0) {
      this.logger.log(`Purged ${removed} orphaned cover images`);
    }
    return removed;
  }

  private async detectMimeType(path: string): Promise<string | null> {
    const handle = await open(path, 'r');
    try {
      const head = Buffer.alloc(16);
      await handle.read(head, 0, 16, 0);
      return MAGIC_BYTES.find((entry) => entry.test(head))?.mimeType ?? null;
    } finally {
      await handle.close();
    }
  }

  private async discard(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      this.logger.warn(`Failed to delete the file ${path}: ${String(error)}`);
    }
  }
}

/**
 * The name of a file in our storage, or `null` for an external link.
 * It rejects anything containing a slash or a dot segment - `coverImageUrl` is
 * user input and `/uploads/../../etc/passwd` must never reach `unlink`.
 */
export function localFileName(url: string | null | undefined): string | null {
  const prefix = `${UPLOADS_PUBLIC_PATH}/`;
  if (!url || !url.startsWith(prefix)) return null;

  const name = url.slice(prefix.length);
  if (name.length === 0 || name.includes('/') || name.includes('\\'))
    return null;
  if (name === '.' || name === '..') return null;

  return name;
}
