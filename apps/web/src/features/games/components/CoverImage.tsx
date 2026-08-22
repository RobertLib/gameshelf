import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '~/lib/cn';

/**
 * A game cover with a fallback for when the image is missing or fails to load.
 *
 * The aspect ratio keeps the layout stable even before loading finishes -
 * without it the grid would jump after every image.
 *
 * It remembers **which address** failed, not just "it failed". In the list that
 * makes no difference, but in the form `coverImageUrl` changes on every keystroke
 * in the address field: the first character breaks loading, and with a plain flag
 * the preview would stay crossed out even after a valid address was typed out or
 * a file was uploaded.
 */
export function CoverImage({
  src,
  title,
  className,
  sizes,
}: {
  src: string | null;
  title: string;
  className?: string;
  sizes?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || src === failedSrc) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600',
          className,
        )}
        aria-hidden
      >
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      // The key forces a new <img> for every address, so loading is reliably
      // retried after a previous failure.
      key={src}
      src={src}
      alt={`Cover of ${title}`}
      loading="lazy"
      decoding="async"
      sizes={sizes}
      onError={() => setFailedSrc(src)}
      className={cn('bg-slate-100 object-cover dark:bg-slate-800', className)}
    />
  );
}
