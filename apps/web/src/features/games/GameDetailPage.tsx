import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Barcode,
  Calendar,
  Heart,
  MapPin,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  COMPLETENESS_LABELS,
  CONDITION_LABELS,
  PLAY_STATUS_LABELS,
  REGION_LABELS,
} from '@gameshelf/contracts';
import { Alert } from '~/components/ui/Alert';
import { Badge } from '~/components/ui/Badge';
import { Button, ButtonLink } from '~/components/ui/Button';
import { Card, CardHeader } from '~/components/ui/Card';
import { ConfirmDialog } from '~/components/ui/ConfirmDialog';
import { PageLoader } from '~/components/ui/Spinner';
import { cn } from '~/lib/cn';
import { errorMessage } from '~/lib/api-error';
import { formatDate, formatMoney, formatTimestamp } from '~/lib/format';
import { useDeleteGame, useGameQuery, useToggleFavorite } from './api';
import { CoverImage } from './components/CoverImage';
import { RatingStars } from './components/RatingStars';
import {
  COMPLETENESS_TONES,
  CONDITION_TONES,
  STATUS_TONES,
} from './components/game-visuals';

export function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const gameQuery = useGameQuery(id);
  const deleteGame = useDeleteGame();
  const toggleFavorite = useToggleFavorite();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (gameQuery.isPending) return <PageLoader label="Loading the game…" />;

  if (gameQuery.isError) {
    return (
      <div className="page-shell max-w-3xl">
        <Alert tone="error" title="The game could not be loaded">
          {errorMessage(gameQuery.error)}
        </Alert>
        <ButtonLink to="/" variant="outline" className="mt-4">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to the collection
        </ButtonLink>
      </div>
    );
  }

  const game = gameQuery.data;

  const handleDelete = async () => {
    await deleteGame.mutateAsync(game.id);
    await navigate('/', { replace: true });
  };

  return (
    <div className="page-shell max-w-5xl">
      <ButtonLink to="/" variant="ghost" size="sm" className="-ml-2 mb-4">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to the collection
      </ButtonLink>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-4">
          <CoverImage
            src={game.coverImageUrl}
            title={game.title}
            className="aspect-[3/4] w-full rounded-card border border-slate-200 dark:border-slate-800"
          />

          <div className="flex gap-2">
            <ButtonLink
              to={`/game/${game.id}/edit`}
              variant="outline"
              className="flex-1"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </ButtonLink>

            <Button
              variant="outline"
              size="icon"
              aria-pressed={game.isFavorite}
              aria-label={
                game.isFavorite ? 'Remove from favorites' : 'Add to favorites'
              }
              onClick={() =>
                toggleFavorite.mutate({
                  id: game.id,
                  isFavorite: !game.isFavorite,
                })
              }
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  game.isFavorite && 'fill-red-500 text-red-500',
                )}
                aria-hidden
              />
            </Button>

            <Button
              variant="outline"
              size="icon"
              aria-label="Remove from the collection"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {game.title}
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {game.platform.name}
              {game.releaseYear !== null && ` · ${game.releaseYear}`}
              {game.edition && ` · ${game.edition}`}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={CONDITION_TONES[game.condition]}>
                {CONDITION_LABELS[game.condition]}
              </Badge>
              <Badge tone={COMPLETENESS_TONES[game.completeness]}>
                {COMPLETENESS_LABELS[game.completeness]}
              </Badge>
              <Badge tone={STATUS_TONES[game.status]}>
                {PLAY_STATUS_LABELS[game.status]}
              </Badge>
              <Badge>{REGION_LABELS[game.region]}</Badge>
              {game.quantity > 1 && <Badge>{game.quantity} copies</Badge>}
            </div>

            <div className="mt-4">
              <RatingStars value={game.rating} />
            </div>
          </header>

          {game.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {game.genres.map((genre) => (
                <Link
                  key={genre.id}
                  to={`/?genreIds=${genre.id}`}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-300"
                >
                  {genre.name}
                </Link>
              ))}
            </div>
          )}

          <Card>
            <CardHeader title="Release details" />
            <dl className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
              <DetailRow label="Developer" value={game.developer} />
              <DetailRow label="Publisher" value={game.publisher} />
              <DetailRow label="Release year" value={game.releaseYear} />
              <DetailRow label="Edition" value={game.edition} />
              <DetailRow
                label="Barcode"
                value={game.barcode}
                icon={Barcode}
                mono
              />
              <DetailRow
                label="Location"
                value={game.storageLocation}
                icon={MapPin}
              />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Purchase" />
            <dl className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
              <DetailRow
                label="Purchase price"
                value={
                  game.purchasePrice === null
                    ? null
                    : formatMoney(game.purchasePrice, game.purchaseCurrency)
                }
                icon={Wallet}
              />
              <DetailRow
                label="Estimated value"
                value={
                  game.estimatedValue === null
                    ? null
                    : formatMoney(game.estimatedValue, game.purchaseCurrency)
                }
              />
              <DetailRow
                label="Purchase date"
                value={game.purchaseDate ? formatDate(game.purchaseDate) : null}
                icon={Calendar}
              />
              <DetailRow label="Bought from" value={game.purchasedFrom} />
            </dl>
          </Card>

          {game.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-wrap p-5 text-sm text-slate-700 dark:text-slate-300">
                {game.notes}
              </p>
            </Card>
          )}

          <p className="text-xs text-slate-400">
            Added {formatTimestamp(game.createdAt)} · last updated{' '}
            {formatTimestamp(game.updatedAt)}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Remove from the collection?"
        description={`The game "${game.title}" will be permanently deleted from your collection.`}
        confirmLabel="Remove"
        destructive
        loading={deleteGame.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
  mono,
}: {
  label: string;
  value: string | number | null;
  icon?: typeof Wallet;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 flex items-center gap-1.5 text-sm',
          value === null || value === ''
            ? 'text-slate-400'
            : 'text-slate-900 dark:text-slate-100',
          mono && 'font-mono',
        )}
      >
        {Icon && value !== null && (
          <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        )}
        {value === null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}
