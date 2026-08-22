import { Link } from 'react-router-dom';
import { Heart, Layers } from 'lucide-react';
import {
  COMPLETENESS_LABELS,
  CONDITION_LABELS,
  REGION_SHORT_LABELS,
  type Game,
} from '@gameshelf/contracts';
import { Badge } from '~/components/ui/Badge';
import { cn } from '~/lib/cn';
import { formatMoney } from '~/lib/format';
import { CoverImage } from './CoverImage';
import { RatingStars } from './RatingStars';
import { CONDITION_TONES } from './game-visuals';

export function GameCard({
  game,
  onToggleFavorite,
}: {
  game: Game;
  onToggleFavorite: (game: Game) => void;
}) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <Link
        to={`/game/${game.id}`}
        className="relative block aspect-[3/4] overflow-hidden"
      >
        <CoverImage
          src={game.coverImageUrl}
          title={game.title}
          sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw"
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {game.quantity > 1 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            <Layers className="h-3 w-3" aria-hidden />
            {game.quantity}×
          </span>
        )}
      </Link>

      {/* The favorite toggle sits outside <Link> so clicking the heart does not
          navigate to the detail page. */}
      <button
        type="button"
        onClick={() => onToggleFavorite(game)}
        aria-pressed={game.isFavorite}
        aria-label={
          game.isFavorite ? 'Remove from favorites' : 'Add to favorites'
        }
        className={cn(
          'absolute right-2 top-2 rounded-full p-1.5 backdrop-blur-sm transition-colors',
          game.isFavorite
            ? 'bg-red-500/90 text-white'
            : 'bg-slate-900/50 text-white/80 opacity-0 hover:bg-slate-900/75 hover:text-white focus-visible:opacity-100 group-hover:opacity-100',
        )}
      >
        <Heart
          className={cn('h-4 w-4', game.isFavorite && 'fill-current')}
          aria-hidden
        />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
            <Link to={`/game/${game.id}`} className="hover:underline">
              {game.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {game.platform.name}
            {game.releaseYear !== null && ` · ${game.releaseYear}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge tone={CONDITION_TONES[game.condition]}>
            {CONDITION_LABELS[game.condition]}
          </Badge>
          <Badge>{REGION_SHORT_LABELS[game.region]}</Badge>
        </div>

        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {COMPLETENESS_LABELS[game.completeness]}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1">
          <RatingStars value={game.rating} />
          {game.purchasePrice !== null && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {formatMoney(game.purchasePrice, game.purchaseCurrency)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
