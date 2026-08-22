import { X } from 'lucide-react';
import type {
  CollectionOverview,
  GameListQuery,
  GameListQueryInput,
} from '@gameshelf/contracts';
import { buildChips } from './active-filter-chips';

/**
 * An overview of the active filters above the list.
 *
 * With a compound filter it is otherwise easy to forget that a region or a price
 * range is still ticked and to wonder why a game is "missing". Every chip can be
 * cleared with a single click.
 */
export function ActiveFilters({
  query,
  overview,
  onChange,
}: {
  query: GameListQuery;
  overview: CollectionOverview | undefined;
  onChange: (patch: Partial<GameListQueryInput>) => void;
}) {
  const chips = buildChips(query, overview);
  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onChange(chip.clear)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white py-1 pl-3 pr-2 text-xs font-medium text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-300"
          >
            {chip.label}
            <X className="h-3 w-3" aria-hidden />
            <span className="sr-only">Clear filter</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
