import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  COMPLETENESS_LABELS,
  CONDITION_LABELS,
  CURRENCY_LABELS,
  GAME_CREATE_DEFAULTS,
  MIN_RELEASE_YEAR,
  PLAY_STATUS_LABELS,
  REGION_LABELS,
  createGameSchema,
  maxReleaseYear,
  optionsFrom,
  type Catalog,
  type CreateGameInput,
  type Game,
} from '@gameshelf/contracts';
import { Alert } from '~/components/ui/Alert';
import { Button, ButtonLink } from '~/components/ui/Button';
import { Card, CardHeader } from '~/components/ui/Card';
import { Field } from '~/components/ui/Field';
import { Input, Select, Textarea } from '~/components/ui/Input';
import { useFormApiErrors } from '~/lib/use-form-api-errors';
import { zodFormResolver } from '~/lib/zod-resolver';
import { CoverField } from './CoverField';
import { GenrePicker } from './GenrePicker';

/** The fields the contract describes. The single source of truth about that list. */
type ContractField = keyof typeof createGameSchema.shape;

/**
 * The values as the form holds them: both numbers and dates are strings, because
 * that is exactly what HTML fields return. The conversion to domain types is
 * done by `createGameSchema` inside the resolver - the very schema the server
 * validates the input with.
 *
 * `extends Record<ContractField, unknown>` is a deliberate safety net: as soon
 * as a field is added to the contract, this interface stops compiling until
 * somebody adds it here too. Without it the lists would silently drift apart.
 */
export interface GameFormValues extends Record<ContractField, unknown> {
  title: string;
  platformId: string;
  genreIds: string[];
  releaseYear: string;
  developer: string;
  publisher: string;
  edition: string;
  barcode: string;
  region: string;
  condition: string;
  completeness: string;
  status: string;
  quantity: string;
  isFavorite: boolean;
  rating: string;
  coverImageUrl: string | null;
  purchasePrice: string;
  purchaseCurrency: string;
  purchaseDate: string;
  purchasedFrom: string;
  estimatedValue: string;
  storageLocation: string;
  notes: string;
}

/**
 * The fields a server error can be attached to - taken straight from the
 * contract rather than copied. A hand-maintained list would sooner or later
 * drift from the schema, and an error on a new field would then silently end up
 * as a message above the form.
 */
const FORM_FIELDS = Object.keys(createGameSchema.shape) as ReadonlyArray<
  ContractField & keyof GameFormValues
>;

export function GameForm({
  catalog,
  game,
  submitLabel,
  onSubmit,
}: {
  catalog: Catalog;
  /** The filled-in game when editing; `undefined` when creating a new one. */
  game?: Game;
  submitLabel: string;
  onSubmit: (values: CreateGameInput) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GameFormValues, unknown, CreateGameInput>({
    resolver: zodFormResolver(createGameSchema),
    defaultValues: toFormValues(game),
  });

  const applyApiErrors = useFormApiErrors<GameFormValues>(
    setError,
    FORM_FIELDS,
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setFormError(applyApiErrors(error));
    }
  });

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-6"
      noValidate
    >
      {formError && <Alert tone="error">{formError}</Alert>}

      {/* --- Basics ----------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Basics"
          description="What game it is and what it runs on."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Title"
            htmlFor="title"
            error={errors.title?.message}
            required
            className="sm:col-span-2"
          >
            <Input
              id="title"
              autoFocus
              placeholder="e.g. Gran Turismo 4"
              {...register('title')}
            />
          </Field>

          <Field
            label="Platform"
            htmlFor="platformId"
            error={errors.platformId?.message}
            required
          >
            <Select id="platformId" {...register('platformId')}>
              <option value="">— select —</option>
              {catalog.platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Release year"
            htmlFor="releaseYear"
            error={errors.releaseYear?.message}
          >
            <Input
              id="releaseYear"
              type="number"
              inputMode="numeric"
              min={MIN_RELEASE_YEAR}
              max={maxReleaseYear()}
              placeholder="2004"
              {...register('releaseYear')}
            />
          </Field>

          <Field
            label="Developer"
            htmlFor="developer"
            error={errors.developer?.message}
          >
            <Input
              id="developer"
              placeholder="Polyphony Digital"
              {...register('developer')}
            />
          </Field>

          <Field
            label="Publisher"
            htmlFor="publisher"
            error={errors.publisher?.message}
          >
            <Input
              id="publisher"
              placeholder="Sony"
              {...register('publisher')}
            />
          </Field>

          <Field
            label="Genres"
            htmlFor="genreIds"
            error={errors.genreIds?.message}
            hint="At most 10 genres."
            className="sm:col-span-2"
          >
            <Controller
              control={control}
              name="genreIds"
              render={({ field }) => (
                <GenrePicker
                  genres={catalog.genres}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
        </div>
      </Card>

      {/* --- The physical copy ------------------------------------------ */}
      <Card>
        <CardHeader
          title="The physical copy"
          description="The details a collection is really sorted by."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Region" htmlFor="region" error={errors.region?.message}>
            <Select id="region" {...register('region')}>
              {optionsFrom(REGION_LABELS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Condition"
            htmlFor="condition"
            error={errors.condition?.message}
          >
            <Select id="condition" {...register('condition')}>
              {optionsFrom(CONDITION_LABELS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Completeness"
            htmlFor="completeness"
            error={errors.completeness?.message}
          >
            <Select id="completeness" {...register('completeness')}>
              {optionsFrom(COMPLETENESS_LABELS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Edition"
            htmlFor="edition"
            error={errors.edition?.message}
            hint="Platinum, Collector’s Edition…"
          >
            <Input id="edition" {...register('edition')} />
          </Field>

          <Field
            label="Barcode"
            htmlFor="barcode"
            error={errors.barcode?.message}
          >
            <Input id="barcode" inputMode="numeric" {...register('barcode')} />
          </Field>

          <Field
            label="Number of copies"
            htmlFor="quantity"
            error={errors.quantity?.message}
          >
            <Input
              id="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              {...register('quantity')}
            />
          </Field>

          <Field
            label="Location"
            htmlFor="storageLocation"
            error={errors.storageLocation?.message}
            hint="Where you physically find the game."
            className="sm:col-span-2"
          >
            <Input
              id="storageLocation"
              placeholder="Shelf A / 2nd row"
              {...register('storageLocation')}
            />
          </Field>
        </div>
      </Card>

      {/* --- Cover ------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Cover"
          description="The thumbnail in the collection list."
        />
        <div className="p-5">
          <Controller
            control={control}
            name="coverImageUrl"
            render={({ field }) => (
              <CoverField
                value={field.value}
                onChange={field.onChange}
                error={errors.coverImageUrl?.message}
              />
            )}
          />
        </div>
      </Card>

      {/* --- Playing and rating ----------------------------------------- */}
      <Card>
        <CardHeader title="Playing and rating" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Play status"
            htmlFor="status"
            error={errors.status?.message}
          >
            <Select id="status" {...register('status')}>
              {optionsFrom(PLAY_STATUS_LABELS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Rating"
            htmlFor="rating"
            error={errors.rating?.message}
            hint="1 to 10, or leave it empty."
          >
            <Input
              id="rating"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              {...register('rating')}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-brand-600 dark:border-slate-600"
              {...register('isFavorite')}
            />
            Mark as a favorite
          </label>

          <Field
            label="Notes"
            htmlFor="notes"
            error={errors.notes?.message}
            className="sm:col-span-2"
          >
            <Textarea
              id="notes"
              rows={4}
              placeholder="Condition of the manual, scratches on the disc, history of the copy…"
              {...register('notes')}
            />
          </Field>
        </div>
      </Card>

      {/* --- Purchase --------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Purchase"
          description="Optional, but it lets the overview know the collection's value."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Purchase price"
            htmlFor="purchasePrice"
            error={errors.purchasePrice?.message}
          >
            <Input
              id="purchasePrice"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              placeholder="799"
              {...register('purchasePrice')}
            />
          </Field>

          <Field
            label="Currency"
            htmlFor="purchaseCurrency"
            error={errors.purchaseCurrency?.message}
          >
            <Select id="purchaseCurrency" {...register('purchaseCurrency')}>
              {optionsFrom(CURRENCY_LABELS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                  {option.label === option.value ? '' : ` (${option.label})`}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Estimated value"
            htmlFor="estimatedValue"
            error={errors.estimatedValue?.message}
            hint="What the copy is worth today."
          >
            <Input
              id="estimatedValue"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              {...register('estimatedValue')}
            />
          </Field>

          <Field
            label="Purchase date"
            htmlFor="purchaseDate"
            error={errors.purchaseDate?.message}
          >
            <Input
              id="purchaseDate"
              type="date"
              {...register('purchaseDate')}
            />
          </Field>

          <Field
            label="Bought from"
            htmlFor="purchasedFrom"
            error={errors.purchasedFrom?.message}
            className="sm:col-span-1 lg:col-span-2"
          >
            <Input
              id="purchasedFrom"
              placeholder="eBay, a second-hand shop, a swap meet…"
              {...register('purchasedFrom')}
            />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-slate-800 dark:bg-slate-950/90">
        <ButtonLink variant="outline" to={game ? `/game/${game.id}` : '/'}>
          Cancel
        </ButtonLink>
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!isDirty && Boolean(game)}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * A domain game -> form values (an empty string instead of `null`).
 *
 * The defaults for a new game come from `GAME_CREATE_DEFAULTS`, not from a list
 * of its own. While `?? 'PAL'` stood here, those were two copies of the same
 * decision - and they could drift silently, because the form always sends the
 * value, so the server would never use its `.default()` and nobody would miss
 * anything.
 */
function toFormValues(game: Game | undefined): GameFormValues {
  return {
    title: game?.title ?? '',
    platformId: game?.platform.id ?? '',
    genreIds: game?.genres.map((genre) => genre.id) ?? [
      ...GAME_CREATE_DEFAULTS.genreIds,
    ],
    releaseYear: game?.releaseYear?.toString() ?? '',
    developer: game?.developer ?? '',
    publisher: game?.publisher ?? '',
    edition: game?.edition ?? '',
    barcode: game?.barcode ?? '',
    region: game?.region ?? GAME_CREATE_DEFAULTS.region,
    condition: game?.condition ?? GAME_CREATE_DEFAULTS.condition,
    completeness: game?.completeness ?? GAME_CREATE_DEFAULTS.completeness,
    status: game?.status ?? GAME_CREATE_DEFAULTS.status,
    quantity: (game?.quantity ?? GAME_CREATE_DEFAULTS.quantity).toString(),
    isFavorite: game?.isFavorite ?? GAME_CREATE_DEFAULTS.isFavorite,
    rating: game?.rating?.toString() ?? '',
    coverImageUrl: game?.coverImageUrl ?? null,
    purchasePrice: game?.purchasePrice?.toString() ?? '',
    purchaseCurrency:
      game?.purchaseCurrency ?? GAME_CREATE_DEFAULTS.purchaseCurrency,
    purchaseDate: game?.purchaseDate ?? '',
    purchasedFrom: game?.purchasedFrom ?? '',
    estimatedValue: game?.estimatedValue?.toString() ?? '',
    storageLocation: game?.storageLocation ?? '',
    notes: game?.notes ?? '',
  };
}
