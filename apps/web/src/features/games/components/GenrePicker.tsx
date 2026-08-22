import { Check } from 'lucide-react';
import type { Genre } from '@gameshelf/contracts';
import { cn } from '~/lib/cn';

/**
 * Genre selection as a field of toggleable chips.
 *
 * A classic `<select multiple>` is miserable to operate by touch, and with
 * twenty genres it is impossible to see what is ticked. Chips are legible and
 * can be driven with the keyboard as well as the mouse.
 */
export function GenrePicker({
  genres,
  value,
  onChange,
}: {
  genres: Genre[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Genres">
      {genres.map((genre) => {
        const selected = value.includes(genre.id);
        return (
          <button
            key={genre.id}
            type="button"
            onClick={() => toggle(genre.id)}
            aria-pressed={selected}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors',
              selected
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-brand-300',
            )}
          >
            {selected && <Check className="h-3 w-3" aria-hidden />}
            {genre.name}
          </button>
        );
      })}
    </div>
  );
}
