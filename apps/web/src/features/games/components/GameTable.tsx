import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Heart } from 'lucide-react';
import {
  COMPLETENESS_LABELS,
  CONDITION_LABELS,
  GAME_SORT_FIELD_LABELS,
  PLAY_STATUS_LABELS,
  type Game,
  type GameListQuery,
  type GameSortField,
} from '@gameshelf/contracts';
import { Badge } from '~/components/ui/Badge';
import { cn } from '~/lib/cn';
import { formatMoney } from '~/lib/format';
import { CoverImage } from './CoverImage';
import { RatingStars } from './RatingStars';
import { CONDITION_TONES, STATUS_TONES } from './game-visuals';

/** The columns that can be clicked to sort by. */
const SORTABLE: Array<{ field: GameSortField; className?: string }> = [
  { field: 'title' },
  { field: 'platform', className: 'hidden md:table-cell' },
  { field: 'releaseYear', className: 'hidden lg:table-cell' },
  { field: 'condition', className: 'hidden lg:table-cell' },
  { field: 'rating', className: 'hidden xl:table-cell' },
  { field: 'purchasePrice', className: 'hidden xl:table-cell' },
];

export function GameTable({
  games,
  query,
  onSortChange,
  onToggleFavorite,
}: {
  games: Game[];
  query: GameListQuery;
  onSortChange: (sort: GameSortField) => void;
  onToggleFavorite: (game: Game) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-slate-50 text-left dark:bg-slate-900">
          <tr>
            <th scope="col" className="w-12 px-3 py-2">
              <span className="sr-only">Cover</span>
            </th>
            {SORTABLE.map(({ field, className }) => (
              <SortableHeader
                key={field}
                field={field}
                query={query}
                onSortChange={onSortChange}
                className={className}
              />
            ))}
            <th
              scope="col"
              className="hidden px-3 py-2 font-medium sm:table-cell"
            >
              Play status
            </th>
            <th scope="col" className="w-12 px-3 py-2">
              <span className="sr-only">Favorite</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
          {games.map((game) => (
            <tr
              key={game.id}
              className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <td className="px-3 py-2">
                <CoverImage
                  src={game.coverImageUrl}
                  title={game.title}
                  className="h-12 w-9 rounded"
                />
              </td>

              <td className="px-3 py-2">
                <Link
                  to={`/game/${game.id}`}
                  className="font-medium text-slate-900 hover:text-brand-600 hover:underline dark:text-slate-100 dark:hover:text-brand-400"
                >
                  {game.title}
                </Link>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {COMPLETENESS_LABELS[game.completeness]}
                  {game.quantity > 1 && ` · ${game.quantity}×`}
                </p>
              </td>

              <td className="hidden px-3 py-2 text-slate-600 md:table-cell dark:text-slate-400">
                {game.platform.name}
              </td>
              <td className="hidden px-3 py-2 tabular-nums text-slate-600 lg:table-cell dark:text-slate-400">
                {game.releaseYear ?? '—'}
              </td>
              <td className="hidden px-3 py-2 lg:table-cell">
                <Badge tone={CONDITION_TONES[game.condition]}>
                  {CONDITION_LABELS[game.condition]}
                </Badge>
              </td>
              <td className="hidden px-3 py-2 xl:table-cell">
                <RatingStars value={game.rating} />
              </td>
              <td className="hidden px-3 py-2 tabular-nums text-slate-600 xl:table-cell dark:text-slate-400">
                {formatMoney(game.purchasePrice, game.purchaseCurrency)}
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <Badge tone={STATUS_TONES[game.status]}>
                  {PLAY_STATUS_LABELS[game.status]}
                </Badge>
              </td>

              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(game)}
                  aria-pressed={game.isFavorite}
                  aria-label={
                    game.isFavorite
                      ? `Remove ${game.title} from favorites`
                      : `Add ${game.title} to favorites`
                  }
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                >
                  <Heart
                    className={cn(
                      'h-4 w-4',
                      game.isFavorite && 'fill-red-500 text-red-500',
                    )}
                    aria-hidden
                  />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  field,
  query,
  onSortChange,
  className,
}: {
  field: GameSortField;
  query: GameListQuery;
  onSortChange: (sort: GameSortField) => void;
  className?: string;
}) {
  const active = query.sort === field;
  const Icon = query.order === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      className={cn('px-3 py-2 font-medium', className)}
      // Screen readers then announce the sort direction too, not just that the
      // column is sortable.
      aria-sort={
        active ? (query.order === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        type="button"
        onClick={() => onSortChange(field)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-brand-600 dark:hover:text-brand-400',
          active
            ? 'text-brand-600 dark:text-brand-400'
            : 'text-slate-600 dark:text-slate-400',
        )}
      >
        {GAME_SORT_FIELD_LABELS[field]}
        {active && <Icon className="h-3.5 w-3.5" aria-hidden />}
      </button>
    </th>
  );
}
