import type { Completeness, Condition, PlayStatus } from '@gameshelf/contracts';
import type { BadgeTone } from '~/components/ui/Badge';

/**
 * The color tuning of the badges - and nothing else.
 *
 * The labels come straight from `*_LABELS` in the contracts; there used to be
 * wrapper functions next to them (`conditionLabel(v)` -> `CONDITION_LABELS[v]`)
 * that only hid the indexing and added another place to maintain. The shortened
 * region names moved into the contracts as `REGION_SHORT_LABELS`, because that
 * is domain text, not a question of appearance.
 *
 * The point of this table is that "Mint" is green and "Poor" red the same way
 * everywhere - in a tile, in the table and on the detail page.
 */

export const CONDITION_TONES: Record<Condition, BadgeTone> = {
  MINT: 'green',
  VERY_GOOD: 'green',
  GOOD: 'blue',
  ACCEPTABLE: 'amber',
  POOR: 'red',
};

export const STATUS_TONES: Record<PlayStatus, BadgeTone> = {
  NOT_STARTED: 'neutral',
  PLAYING: 'blue',
  COMPLETED: 'green',
  ON_HOLD: 'amber',
  DROPPED: 'red',
};

export const COMPLETENESS_TONES: Record<Completeness, BadgeTone> = {
  SEALED: 'brand',
  COMPLETE_IN_BOX: 'green',
  BOXED_NO_MANUAL: 'blue',
  LOOSE: 'neutral',
  MANUAL_ONLY: 'neutral',
  BOX_ONLY: 'neutral',
};
