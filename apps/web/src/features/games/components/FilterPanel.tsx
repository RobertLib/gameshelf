import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import {
  maxReleaseYear,
  optionsFrom,
  type CollectionOverview,
  type FacetBucket,
  type GameListQuery,
  type GameListQueryInput,
} from '@gameshelf/contracts';
import { Button } from '~/components/ui/Button';
import { Input, Select } from '~/components/ui/Input';
import { cn } from '~/lib/cn';
import { formatNumber } from '~/lib/format';
import { ENUM_FACETS, enumFacetPatch, selectedValues } from './enum-facets';

interface FilterPanelProps {
  query: GameListQuery;
  overview: CollectionOverview | undefined;
  onChange: (patch: Partial<GameListQueryInput>) => void;
  onReset: () => void;
  activeCount: number;
}

/**
 * The filter panel.
 *
 * The choices are built from `overview` - that is, from what the user actually
 * owns, with a count next to every option. Empty sections are not rendered at
 * all, so the panel grows with the collection and does not overwhelm at the
 * start.
 */
export function FilterPanel({
  query,
  overview,
  onChange,
  onReset,
  activeCount,
}: FilterPanelProps) {
  const facets = overview?.facets;

  return (
    <div className="flex flex-col gap-4">
      <SearchField value={query.q ?? ''} onChange={(q) => onChange({ q })} />

      {activeCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full"
        >
          <X className="h-4 w-4" aria-hidden />
          Clear filters ({activeCount})
        </Button>
      )}

      <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {facets?.platforms.length ? (
          <FilterSection
            title="Platform"
            count={query.platformIds?.length}
            defaultOpen
          >
            <FacetCheckboxes
              options={facets.platforms}
              selected={query.platformIds ?? []}
              scrollable
              onChange={(platformIds) => onChange({ platformIds })}
            />
          </FilterSection>
        ) : null}

        {facets?.genres.length ? (
          <FilterSection title="Genre" count={query.genreIds?.length}>
            <FacetCheckboxes
              options={facets.genres}
              selected={query.genreIds ?? []}
              scrollable
              onChange={(genreIds) => onChange({ genreIds })}
            />
            {(query.genreIds?.length ?? 0) > 1 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={query.genreMatch === 'all'}
                  onChange={(event) =>
                    onChange({
                      genreMatch: event.target.checked ? 'all' : 'any',
                    })
                  }
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-600 dark:border-slate-600"
                />
                Must have every selected genre
              </label>
            )}
          </FilterSection>
        ) : null}

        {ENUM_FACETS.map(({ key, title, labels }) => (
          <FilterSection
            key={key}
            title={title}
            count={selectedValues(query, key).length}
          >
            <FacetCheckboxes
              options={overviewOrLabels(facets?.[key], labels)}
              selected={selectedValues(query, key)}
              onChange={(values) => onChange(enumFacetPatch(key, values))}
            />
          </FilterSection>
        ))}

        <FilterSection
          title="Release year"
          count={query.yearFrom || query.yearTo ? 1 : 0}
        >
          <RangeInputs
            fromValue={query.yearFrom}
            toValue={query.yearTo}
            placeholderFrom={String(overview?.stats.oldestReleaseYear ?? 1985)}
            placeholderTo={String(
              overview?.stats.newestReleaseYear ?? maxReleaseYear(),
            )}
            onChange={(yearFrom, yearTo) => onChange({ yearFrom, yearTo })}
          />
        </FilterSection>

        <FilterSection
          title="Rating"
          count={query.ratingFrom || query.ratingTo ? 1 : 0}
        >
          <RangeInputs
            fromValue={query.ratingFrom}
            toValue={query.ratingTo}
            placeholderFrom="1"
            placeholderTo="10"
            min={1}
            max={10}
            onChange={(ratingFrom, ratingTo) =>
              onChange({ ratingFrom, ratingTo })
            }
          />
        </FilterSection>

        <FilterSection
          title="Purchase price"
          count={query.priceFrom || query.priceTo ? 1 : 0}
        >
          <RangeInputs
            fromValue={query.priceFrom}
            toValue={query.priceTo}
            placeholderFrom="0"
            placeholderTo="5000"
            min={0}
            step="0.01"
            onChange={(priceFrom, priceTo) => onChange({ priceFrom, priceTo })}
          />
        </FilterSection>

        {facets?.storageLocations.length ? (
          <FilterSection title="Location" count={query.storageLocation ? 1 : 0}>
            <FacetSelect
              value={query.storageLocation ?? ''}
              options={facets.storageLocations}
              placeholder="Anywhere"
              onChange={(storageLocation) => onChange({ storageLocation })}
            />
          </FilterSection>
        ) : null}

        {facets?.developers.length ? (
          <FilterSection title="Developer" count={query.developer ? 1 : 0}>
            <FacetSelect
              value={query.developer ?? ''}
              options={facets.developers}
              placeholder="Anyone"
              onChange={(developer) => onChange({ developer })}
            />
          </FilterSection>
        ) : null}

        {facets?.publishers.length ? (
          <FilterSection title="Publisher" count={query.publisher ? 1 : 0}>
            <FacetSelect
              value={query.publisher ?? ''}
              options={facets.publishers}
              placeholder="Anyone"
              onChange={(publisher) => onChange({ publisher })}
            />
          </FilterSection>
        ) : null}

        {facets?.purchasedFrom.length ? (
          <FilterSection
            title="Bought from"
            count={query.purchasedFrom ? 1 : 0}
          >
            <FacetSelect
              value={query.purchasedFrom ?? ''}
              options={facets.purchasedFrom}
              placeholder="Anywhere"
              onChange={(purchasedFrom) => onChange({ purchasedFrom })}
            />
          </FilterSection>
        ) : null}

        <FilterSection title="More" defaultOpen>
          <div className="flex flex-col gap-3">
            <BooleanFilter
              label="Favorites"
              value={query.isFavorite}
              whenTrue="Favorites only"
              whenFalse="Everything but favorites"
              onChange={(isFavorite) => onChange({ isFavorite })}
            />
            <BooleanFilter
              label="Cover"
              value={query.hasCover}
              whenTrue="With a cover only"
              whenFalse="Without a cover only"
              onChange={(hasCover) => onChange({ hasCover })}
            />
            <BooleanFilter
              label="Rating"
              value={query.unrated}
              whenTrue="Not rated only"
              whenFalse="Rated only"
              onChange={(unrated) => onChange({ unrated })}
            />
          </div>
        </FilterSection>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Debounced search - typing should not fire a request for every character. The
 * inner state is reconciled with the outer one when the filter changes elsewhere
 * (with the Clear filters button, for instance).
 */
function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const id = useId();

  /**
   * `onChange` arrives as an inline function from the parent, so it gets a new
   * identity on every render of it. In the effect's dependencies, every render
   * (even a mere "loading" change) would therefore extend the wait by another
   * 300 ms. We keep it in a ref and leave only what really matters in the
   * dependencies.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /**
   * The filter may also have changed elsewhere - with the "Clear filters" button
   * or a link from the dashboard. The reconciliation happens during the render,
   * not in an effect: React then repeats the render before painting, so there is
   * no intermediate state with the old text and no cascade of effects (the
   * approach from the docs, "Adjusting state when a prop changes").
   */
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => onChangeRef.current(draft), 300);
    return () => window.clearTimeout(timer);
  }, [draft, value]);

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search the collection
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        id={id}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Title, developer, barcode…"
        className="pl-9"
      />
    </div>
  );
}

function FilterSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    // <details> gives expanding for free even without JS, keyboard control
    // included.
    <details open={defaultOpen} className="group py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-slate-700 marker:content-none dark:text-slate-300">
        <span className="flex items-center gap-2">
          {title}
          {count ? (
            <span className="rounded-full bg-brand-100 px-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/**
 * A list of checkboxes over one group of options.
 *
 * `scrollable` is the only difference between a lookup table (platforms, genres -
 * easily dozens of items, hence the scrolling) and an enum (five values, fits
 * entirely).
 */
function FacetCheckboxes({
  options,
  selected,
  scrollable,
  onChange,
}: {
  options: FacetBucket[];
  selected: string[];
  scrollable?: boolean;
  onChange: (values: string[] | undefined) => void;
}) {
  return (
    <ul
      className={cn(
        'flex flex-col gap-1',
        scrollable && 'max-h-56 overflow-y-auto pr-1',
      )}
    >
      {options.map((option) => (
        <li key={option.value}>
          <CheckboxRow
            label={option.label}
            count={option.count}
            checked={selected.includes(option.value)}
            onChange={(checked) =>
              onChange(toggleValue(selected, option.value, checked))
            }
          />
        </li>
      ))}
    </ul>
  );
}

function CheckboxRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-sm transition-colors',
        'hover:bg-slate-100 dark:hover:bg-slate-800',
        checked
          ? 'text-slate-900 dark:text-slate-100'
          : 'text-slate-600 dark:text-slate-400',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-brand-600 dark:border-slate-600"
        />
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {formatNumber(count)}
        </span>
      )}
    </label>
  );
}

function FacetSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: FacetBucket[];
  placeholder: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label} ({option.count})
        </option>
      ))}
    </Select>
  );
}

function RangeInputs({
  fromValue,
  toValue,
  placeholderFrom,
  placeholderTo,
  min,
  max,
  step,
  onChange,
}: {
  fromValue: number | undefined;
  toValue: number | undefined;
  placeholderFrom: string;
  placeholderTo: string;
  min?: number;
  max?: number;
  step?: string;
  onChange: (from: number | undefined, to: number | undefined) => void;
}) {
  /**
   * The panel never produces a reversed range.
   *
   * The contract rejects `from > to` (it would honestly return an empty
   * collection, which reads as "you own nothing like this"), so the edit that
   * would cross the other end pushes it along instead - the way both ends of a
   * range slider behave. Both fields visibly hold the same number afterwards, so
   * it is obvious what happened; clamping the typed value silently, or dropping
   * the other bound, would fight whoever is typing.
   */
  const changeFrom = (raw: string) => {
    const from = numberOrUndefined(raw);
    const crosses =
      from !== undefined && toValue !== undefined && from > toValue;
    onChange(from, crosses ? from : toValue);
  };

  const changeTo = (raw: string) => {
    const to = numberOrUndefined(raw);
    const crosses =
      to !== undefined && fromValue !== undefined && to < fromValue;
    onChange(crosses ? to : fromValue, to);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="numeric"
        aria-label="From"
        value={fromValue ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholderFrom}
        onChange={(event) => changeFrom(event.target.value)}
      />
      <span className="text-slate-400" aria-hidden>
        –
      </span>
      <Input
        type="number"
        inputMode="numeric"
        aria-label="To"
        value={toValue ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholderTo}
        onChange={(event) => changeTo(event.target.value)}
      />
    </div>
  );
}

/**
 * A filter over a boolean column, which has three states, not two: unset, true
 * and false.
 *
 * A checkbox can only express two of them, so `?hasCover=true` and
 * `?unrated=false` were reachable by hand-editing the address but not from the
 * panel - `ActiveFilters` even drew a chip for them ("With a cover", "Rated
 * only") that the panel itself could never produce. A select says all three out
 * loud and the chips keep matching it.
 */
function BooleanFilter({
  label,
  value,
  whenTrue,
  whenFalse,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  whenTrue: string;
  whenFalse: string;
  onChange: (value: boolean | undefined) => void;
}) {
  const id = useId();

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs text-slate-500 dark:text-slate-400"
      >
        {label}
      </label>
      <Select
        id={id}
        value={value === undefined ? '' : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === ''
              ? undefined
              : event.target.value === 'true',
          )
        }
      >
        <option value="">Any</option>
        <option value="true">{whenTrue}</option>
        <option value="false">{whenFalse}</option>
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function toggleValue(
  current: string[],
  value: string,
  checked: boolean,
): string[] | undefined {
  const next = checked
    ? [...current, value]
    : current.filter((item) => item !== value);
  // An empty array is better as `undefined` so `?regions=` does not linger in
  // the URL.
  return next.length > 0 ? next : undefined;
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Prefers the counts from the collection. Until the overview loads (or while the
 * collection is empty), it offers at least every enum value without counts, so
 * the panel is not half empty for a moment.
 */
function overviewOrLabels(
  buckets: FacetBucket[] | undefined,
  labels: Record<string, string>,
): FacetBucket[] {
  if (buckets && buckets.length > 0) return buckets;
  return optionsFrom(labels).map(({ value, label }) => ({
    value,
    label,
    count: 0,
  }));
}
