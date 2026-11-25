import { cn } from '~/utils/index';

import { inspectorFocusRingClass } from '../properties-inspector/inspector-control-classes';

/** One labelled field row in the options dialog (Orbit InspectorField, label first). */
export const optionRowClass = 'flex min-w-0 max-w-[56rem] items-center gap-xxx-sm';

/** Field label: Space Grotesk 14, dim, fixed column so the boxes line up. */
export const optionLabelClass = 'w-[22rem] shrink-0 truncate font-sans text-body-sm text-on-surface-dim';

/** Group heading above a block of fields. */
export const optionGroupClass = 'font-mono text-label uppercase text-on-surface-dim';

/** Outlined field box: 1 px line on the page surface, signal on focus, dashed when off. */
export const optionBoxClass = cn(
  'flex h-row min-w-0 flex-1 items-center gap-xxx-sm border border-line bg-surface px-xxx-sm',
  'font-sans text-body-sm text-on-surface outline-none transition-colors duration-short',
  'hover:border-on-surface-dim focus:border-accent focus-visible:border-accent data-[state=open]:border-accent',
  'disabled:cursor-not-allowed disabled:border-dashed disabled:text-on-surface-dim disabled:hover:border-line',
);

/** Read-only value next to a dim term (recording readouts). */
export const optionReadoutRowClass =
  'flex max-w-[56rem] items-baseline justify-between gap-md border-b border-line py-tiny';

/** Plain text action (Open, Close): white, signal on hover. */
export const optionTextActionClass = cn(
  'font-sans text-body-sm text-on-surface transition-colors duration-short hover:text-accent active:text-accent-dim',
  inspectorFocusRingClass,
);
