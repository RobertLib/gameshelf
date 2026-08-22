import type { Currency } from '@gameshelf/contracts';

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFormat = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

/**
 * Currency formatters are cached: building an `Intl.NumberFormat` is not free
 * and the collection list asks for the same currency on every row.
 *
 * Amounts with a fractional part are written to two places ("$349.50"), whole
 * amounts stay without the extra zeros ("$2,490").
 */
const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: Currency, fractionDigits: 0 | 2) {
  const key = `${currency}:${fractionDigits}`;
  let formatter = moneyFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    moneyFormats.set(key, formatter);
  }
  return formatter;
}

/** "$2,490.50" - the symbol goes where the locale puts it. */
export function formatMoney(
  amount: number | null,
  currency: Currency | null,
): string {
  if (amount === null) return '—';
  if (!currency) return numberFormat.format(amount);
  return moneyFormat(currency, Number.isInteger(amount) ? 0 : 2).format(amount);
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** A date in the YYYY-MM-DD form (as the API returns it) as readable text. */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : dateFormat.format(date);
}

/** Date and time from an ISO timestamp. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : shortDateFormat.format(date);
}

/** "1 game" vs. "5 games". */
export function pluralize(
  count: number,
  forms: [one: string, other: string],
): string {
  return count === 1 ? forms[0] : forms[1];
}

export function gamesLabel(count: number): string {
  return `${formatNumber(count)} ${pluralize(count, ['game', 'games'])}`;
}
