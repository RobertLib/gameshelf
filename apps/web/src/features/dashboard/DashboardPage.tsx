import {
  BadgeCheck,
  CalendarRange,
  Heart,
  Layers,
  Library,
  Monitor,
  Star,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FacetBucket } from '@gameshelf/contracts';
import { Alert } from '~/components/ui/Alert';
import { ButtonLink } from '~/components/ui/Button';
import { Card, CardHeader } from '~/components/ui/Card';
import { EmptyState } from '~/components/ui/EmptyState';
import { PageLoader } from '~/components/ui/Spinner';
import { errorMessage } from '~/lib/api-error';
import { formatMoney, formatNumber } from '~/lib/format';
import { useCollectionOverview } from '~/features/games/api';

/**
 * The collection summary.
 *
 * Both the numbers and the breakdowns come from the single `games/overview`
 * endpoint, whose response also feeds the filters in the list - so the dashboard
 * adds no further database queries.
 */
export function DashboardPage() {
  const overview = useCollectionOverview();

  if (overview.isPending)
    return <PageLoader label="Counting your collection…" />;

  if (overview.isError) {
    return (
      <div className="page-shell">
        <Alert tone="error" title="The overview could not be loaded">
          {errorMessage(overview.error)}
        </Alert>
      </div>
    );
  }

  const { stats, facets } = overview.data;

  if (stats.totalGames === 0) {
    return (
      <div className="page-shell">
        <EmptyState
          icon={Library}
          title="Nothing to count yet"
          description="As soon as you add your first games, you will see the collection broken down by platform, genre and value."
          action={<ButtonLink to="/game/new">Add your first game</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Collection overview
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          How your shelf is doing.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Library}
          label="Titles in the collection"
          value={formatNumber(stats.totalGames)}
        />
        <StatCard
          icon={Layers}
          label="Physical copies"
          value={formatNumber(stats.totalCopies)}
        />
        <StatCard
          icon={Monitor}
          label="Platforms"
          value={formatNumber(stats.totalPlatforms)}
        />
        <StatCard
          icon={BadgeCheck}
          label="Completed"
          value={formatNumber(stats.completedCount)}
        />
        <StatCard
          icon={Wallet}
          label="Invested"
          value={
            stats.totalPurchaseValue === null
              ? '—'
              : formatMoney(stats.totalPurchaseValue, stats.valueCurrency)
          }
          hint={
            stats.pricedGamesCount === 0
              ? 'You have not filled in a purchase price for any game yet.'
              : stats.valueCurrency === null
                ? 'The collection uses several currencies, so a total would make no sense.'
                : undefined
          }
        />
        <StatCard
          icon={Wallet}
          label="Estimated value"
          value={
            stats.totalEstimatedValue === null
              ? '—'
              : formatMoney(stats.totalEstimatedValue, stats.valueCurrency)
          }
        />
        <StatCard
          icon={Star}
          label="Average rating"
          value={
            stats.averageRating === null ? '—' : `${stats.averageRating} / 10`
          }
        />
        <StatCard
          icon={Heart}
          label="Favorites"
          value={formatNumber(stats.favoriteCount)}
        />
      </div>

      {stats.oldestReleaseYear !== null && stats.newestReleaseYear !== null && (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <CalendarRange className="h-4 w-4" aria-hidden />
          The collection spans {stats.oldestReleaseYear}–
          {stats.newestReleaseYear}.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="By platform"
          buckets={facets.platforms}
          total={stats.totalGames}
          linkFor={(bucket) => `/?platformIds=${bucket.value}`}
        />
        <BreakdownCard
          title="By genre"
          buckets={facets.genres}
          total={stats.totalGames}
          linkFor={(bucket) => `/?genreIds=${bucket.value}`}
        />
        <BreakdownCard
          title="By condition"
          buckets={facets.conditions}
          total={stats.totalGames}
          linkFor={(bucket) => `/?conditions=${bucket.value}`}
        />
        <BreakdownCard
          title="By completeness"
          buckets={facets.completeness}
          total={stats.totalGames}
          linkFor={(bucket) => `/?completeness=${bucket.value}`}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Library;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {value}
          </p>
        </div>
        <span className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

/**
 * A breakdown with a horizontal bar. The bar width is computed against the
 * strongest item rather than against the whole - in a collection scattered
 * across twenty platforms every bar would otherwise be indistinguishably short.
 */
function BreakdownCard({
  title,
  buckets,
  total,
  linkFor,
}: {
  title: string;
  buckets: FacetBucket[];
  total: number;
  linkFor: (bucket: FacetBucket) => string;
}) {
  if (buckets.length === 0) return null;

  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <Card>
      <CardHeader title={title} />
      <ul className="flex flex-col gap-2 p-5">
        {buckets.slice(0, 12).map((bucket) => (
          <li key={bucket.value}>
            <Link
              to={linkFor(bucket)}
              className="group flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span className="w-40 shrink-0 truncate text-sm text-slate-700 group-hover:text-brand-700 dark:text-slate-300 dark:group-hover:text-brand-300">
                {bucket.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span
                  className="block h-full rounded-full bg-brand-500"
                  style={{ width: `${(bucket.count / max) * 100}%` }}
                />
              </span>
              <span className="flex w-20 shrink-0 items-baseline justify-end gap-1.5 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                {bucket.count}
                <span className="text-xs text-slate-400">
                  ({Math.round((bucket.count / total) * 100)} %)
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
