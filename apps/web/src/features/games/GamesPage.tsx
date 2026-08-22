import { useCallback, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  LayoutGrid,
  Library,
  Plus,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import {
  GAME_SORT_FIELD_LABELS,
  MAX_PAGE_SIZE,
  gameSortFieldSchema,
  optionsFrom,
  type Game,
  type GameSortField,
} from '@gameshelf/contracts';
import { Alert } from '~/components/ui/Alert';
import { Button, ButtonLink } from '~/components/ui/Button';
import { EmptyState } from '~/components/ui/EmptyState';
import { Select } from '~/components/ui/Input';
import { Pagination } from '~/components/ui/Pagination';
import { Sheet } from '~/components/ui/Sheet';
import { PageLoader, Spinner } from '~/components/ui/Spinner';
import { cn } from '~/lib/cn';
import { errorMessage } from '~/lib/api-error';
import { gamesLabel } from '~/lib/format';
import { useLocalStorage } from '~/lib/use-local-storage';
import { DESKTOP_QUERY, useMediaQuery } from '~/lib/use-media-query';
import { useCollectionOverview, useGamesQuery, useToggleFavorite } from './api';
import { useGameFilters } from './use-game-filters';
import { ActiveFilters } from './components/ActiveFilters';
import { FilterPanel } from './components/FilterPanel';
import { GameCard } from './components/GameCard';
import { GameTable } from './components/GameTable';

type ViewMode = 'grid' | 'table';
const isViewMode = (value: string): value is ViewMode =>
  value === 'grid' || value === 'table';

const PAGE_SIZES = [12, 24, 48, 96].filter((size) => size <= MAX_PAGE_SIZE);

export function GamesPage() {
  const { query, update, reset, activeCount } = useGameFilters();
  const gamesQuery = useGamesQuery(query);
  const overviewQuery = useCollectionOverview();
  const toggleFavorite = useToggleFavorite();

  const [view, setView] = useLocalStorage<ViewMode>(
    'gameshelf:view',
    'grid',
    isViewMode,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  /**
   * `hidden lg:block` would only hide the panel, not unmount it - two instances
   * of it would run at once, each with its own search state and its own debounce.
   */
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const filterPanel = (
    <FilterPanel
      query={query}
      overview={overviewQuery.data}
      onChange={update}
      onReset={reset}
      activeCount={activeCount}
    />
  );

  /**
   * The picker has to contain a value from the address even when it is not among
   * the presets - otherwise `?pageSize=30` would show "12 / page" while paging by
   * thirty.
   */
  const pageSizeOptions = useMemo(
    () => [...new Set([...PAGE_SIZES, query.pageSize])].sort((a, b) => a - b),
    [query.pageSize],
  );

  /**
   * The dependency is `mutate`, not the whole object from `useMutation` - that
   * one gets a new identity after every render (it carries `isPending` and
   * friends), so the memoization would never save anything and every render
   * would hand the cards and the table a new callback. `mutate` is stable.
   */
  const { mutate: mutateFavorite } = toggleFavorite;
  const handleToggleFavorite = useCallback(
    (game: Game) => {
      mutateFavorite({ id: game.id, isFavorite: !game.isFavorite });
    },
    [mutateFavorite],
  );

  /** Clicking an already active column flips the sort direction. */
  const handleSortChange = useCallback(
    (sort: GameSortField) => {
      update(
        sort === query.sort
          ? { order: query.order === 'asc' ? 'desc' : 'asc' }
          : { sort, order: sort === 'title' ? 'asc' : 'desc' },
      );
    },
    [query.sort, query.order, update],
  );

  const isEmptyCollection =
    overviewQuery.data !== undefined &&
    overviewQuery.data.stats.totalGames === 0;

  return (
    <div className="page-shell">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            My collection
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {gamesQuery.data
              ? gamesLabel(gamesQuery.data.meta.totalItems)
              : 'Loading…'}
            {activeCount > 0 && ' match the filter'}
          </p>
        </div>

        <ButtonLink to="/game/new" size="md">
          <Plus className="h-4 w-4" aria-hidden />
          Add a game
        </ButtonLink>
      </header>

      <div className="flex gap-6">
        {/* The sidebar on wide screens */}
        {isDesktop && (
          <aside className="w-72 shrink-0">
            <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              {filterPanel}
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {!isDesktop && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Filters
                {activeCount > 0 && (
                  <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">
                    {activeCount}
                  </span>
                )}
              </Button>
            )}

            <SortControl
              sort={query.sort}
              order={query.order}
              onChange={(sort, order) => update({ sort, order })}
            />

            <div className="ml-auto flex items-center gap-2">
              {gamesQuery.isFetching && <Spinner className="h-4 w-4" />}

              <Select
                aria-label="Items per page"
                className="w-auto"
                value={String(query.pageSize)}
                onChange={(event) =>
                  update({ pageSize: Number(event.target.value) })
                }
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </Select>

              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>

          <div className="mb-4">
            <ActiveFilters
              query={query}
              overview={overviewQuery.data}
              onChange={update}
            />
          </div>

          {gamesQuery.isError ? (
            <Alert tone="error" title="The collection could not be loaded">
              {errorMessage(gamesQuery.error)}
            </Alert>
          ) : gamesQuery.isPending ? (
            <PageLoader label="Loading the collection…" />
          ) : gamesQuery.data.items.length === 0 ? (
            isEmptyCollection ? (
              <EmptyState
                icon={Library}
                title="Your shelf is still empty"
                description="Add your first game and start cataloguing the collection."
                action={
                  <ButtonLink to="/game/new">
                    <Plus className="h-4 w-4" aria-hidden />
                    Add your first game
                  </ButtonLink>
                }
              />
            ) : (
              <EmptyState
                icon={SlidersHorizontal}
                title="Nothing matches the filter"
                description="Try clearing some of the filters or adjusting the search term."
                action={
                  <Button variant="outline" onClick={reset}>
                    Clear all filters
                  </Button>
                }
              />
            )
          ) : (
            <div
              className={cn(
                'transition-opacity',
                // While further data loads we keep the content visible, only dimmed.
                gamesQuery.isPlaceholderData && 'opacity-60',
              )}
            >
              {view === 'grid' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {gamesQuery.data.items.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              ) : (
                <GameTable
                  games={gamesQuery.data.items}
                  query={query}
                  onSortChange={handleSortChange}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}

              <div className="mt-6">
                <Pagination
                  meta={gamesQuery.data.meta}
                  onPageChange={(page) => {
                    update({ page });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {!isDesktop && (
        <Sheet
          open={filtersOpen}
          title="Filters"
          onClose={() => setFiltersOpen(false)}
          footer={
            <Button className="w-full" onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          }
        >
          {filterPanel}
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SortControl({
  sort,
  order,
  onChange,
}: {
  sort: GameSortField;
  order: 'asc' | 'desc';
  onChange: (sort: GameSortField, order: 'asc' | 'desc') => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Select
        aria-label="Sorting"
        className="w-auto"
        value={sort}
        onChange={(event) =>
          onChange(gameSortFieldSchema.parse(event.target.value), order)
        }
      >
        {optionsFrom(GAME_SORT_FIELD_LABELS).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Button
        variant="outline"
        size="icon"
        aria-label={order === 'asc' ? 'Sort descending' : 'Sort ascending'}
        title={order === 'asc' ? 'Ascending' : 'Descending'}
        onClick={() => onChange(sort, order === 'asc' ? 'desc' : 'asc')}
      >
        <ArrowDownUp
          className={cn('h-4 w-4', order === 'desc' && 'rotate-180')}
          aria-hidden
        />
      </Button>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div
      className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700"
      role="group"
      aria-label="View mode"
    >
      {(
        [
          ['grid', LayoutGrid, 'Tiles'],
          ['table', Table2, 'Table'],
        ] as const
      ).map(([mode, Icon, label]) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          aria-label={label}
          title={label}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            value === mode
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
