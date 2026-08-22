import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from '@gameshelf/contracts';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { errorMessage } from '~/lib/api-error';
import { useUploadCover } from '../api';
import { CoverImage } from './CoverImage';

/**
 * A game cover: either an uploaded file or a link to an image elsewhere.
 *
 * Both end up in the same `coverImageUrl` field, so neither the form nor the API
 * needs two different paths. The size and the format are checked here already -
 * the server verifies them again, but the user learns about the problem
 * immediately and without waiting for a five-megabyte upload.
 */
export function CoverField({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCover();
  const [localError, setLocalError] = useState<string | null>(null);
  // The field does not sit inside <Field> here, so it has to wire up the error
  // itself.
  const errorId = useId();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);

    if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setLocalError('Supported formats: JPEG, PNG, WebP, AVIF, GIF.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(
        `The file is too large (max. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`,
      );
      return;
    }

    try {
      const result = await upload.mutateAsync(file);
      onChange(result.url);
    } catch (uploadError) {
      setLocalError(errorMessage(uploadError));
    } finally {
      // So the same file can be uploaded again after being removed.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const shownError = error ?? localError;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <div className="relative h-40 w-30 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <CoverImage src={value} title="preview" className="h-full w-full" />
          {upload.isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
              <Loader2
                className="h-6 w-6 animate-spin text-white"
                aria-hidden
              />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              loading={upload.isPending}
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Upload an image
            </Button>

            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(null);
                  setLocalError(null);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remove
              </Button>
            )}
          </div>

          <Input
            type="url"
            inputMode="url"
            placeholder="…or paste an image address"
            value={value ?? ''}
            invalid={Boolean(shownError)}
            aria-describedby={shownError ? errorId : undefined}
            onChange={(event) => onChange(event.target.value || null)}
          />

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ideally the front of the box in portrait orientation. At most{' '}
            {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.
          </p>
        </div>
      </div>

      {shownError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {shownError}
        </p>
      )}
    </div>
  );
}
