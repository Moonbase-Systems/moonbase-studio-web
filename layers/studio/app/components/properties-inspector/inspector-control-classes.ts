import { cn } from '~/utils/index';

/** Orbit focus ring for keyboard focus. */
export const inspectorFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** Control copy: Space Grotesk 400, 14px (inspector chrome; not the Figma Special/Standard scale). */
export const inspectorBodyTextClass = 'font-sans text-body-sm font-normal';

/** Field label, unit, group heading: Space Mono 12px, upper case. */
export const inspectorLabelTextClass = 'font-mono text-label font-normal uppercase';

/** Control text: Space Grotesk 400, 14px. */
export const inspectorControlTextClass = cn(inspectorBodyTextClass, 'text-on-surface');

/** Field label, unit, group heading: Space Mono 12px, upper case, dim. */
export const inspectorLabelClass = cn(inspectorLabelTextClass, 'shrink-0 text-on-surface-dim');

/** One row of controls inside a property card. */
export const inspectorRowClass =
  'flex w-full min-w-0 flex-wrap items-center justify-start gap-x-sm gap-y-xxx-sm py-tiny';

/** Outlined field shell for dropdown triggers and text inputs. */
export const inspectorFieldShellClass = cn(
  inspectorControlTextClass,
  'flex h-row min-w-0 items-center gap-xxx-sm border border-line bg-transparent px-xxx-sm transition-colors duration-short hover:border-on-surface-dim focus-within:border-accent disabled:cursor-not-allowed disabled:border-dashed disabled:text-on-surface-dim disabled:hover:border-line',
  inspectorFocusRingClass,
);

/** Dropdown chevron glyph. */
export const inspectorChevronClass = 'font-mono text-label text-on-surface-dim transition-transform duration-short';

/** Two-state button (mute, smoothing, decorations). */
export function inspectorToggleClass(active: boolean, disabled = false) {
  return cn(
    inspectorControlTextClass,
    'flex h-row min-w-row items-center justify-center border px-xxx-sm transition-colors duration-short',
    inspectorFocusRingClass,
    active ? 'border-accent text-accent' : 'border-line text-on-surface hover:bg-surface-container-high',
    disabled && 'cursor-not-allowed border-dashed text-on-surface-dim hover:bg-transparent',
  );
}

/** Floating menu panel (overlay). */
export const inspectorMenuPanelClass =
  'fixed z-50 flex flex-col gap-x-tiny border border-line bg-surface-container p-tiny';

/** One item in a floating menu. */
export function inspectorMenuItemClass(selected = false) {
  return cn(
    inspectorControlTextClass,
    'flex h-row shrink-0 items-center px-xxx-sm text-left transition-colors duration-short hover:bg-surface-container-high',
    inspectorFocusRingClass,
    selected && 'text-accent',
  );
}
