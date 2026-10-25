import type { ShortcutKeyBinding, ShortcutModifier, ShortcutPointerBinding } from '../models/shortcut.domain';

const modifierSatisfied = (event: KeyboardEvent | MouseEvent, mod: ShortcutModifier): boolean => {
  switch (mod) {
    case 'mod':
      return event.metaKey || event.ctrlKey;
    case 'shift':
      return event.shiftKey;
    case 'alt':
      return event.altKey;
    case 'ctrl':
      return event.ctrlKey;
    case 'meta':
      return event.metaKey;
    default:
      return false;
  }
};

const allModifiersSatisfied = (
  event: KeyboardEvent | MouseEvent,
  required: ShortcutModifier[] | undefined,
): boolean => {
  const mods = required ?? [];
  if (!mods.every((m) => modifierSatisfied(event, m))) {
    return false;
  }
  for (const mod of ['shift', 'alt', 'ctrl', 'meta'] as const) {
    if (mods.includes(mod)) {
      continue;
    }
    if ((mod === 'ctrl' || mod === 'meta') && mods.includes('mod')) {
      continue;
    }
    if (modifierSatisfied(event, mod)) {
      return false;
    }
  }
  return true;
};

export const matchesShortcutKey = (event: KeyboardEvent, binding: ShortcutKeyBinding): boolean => {
  if (event.key !== binding.key) {
    return false;
  }
  return allModifiersSatisfied(event, binding.modifiers);
};

export const matchesShortcutPointer = (event: MouseEvent, binding: ShortcutPointerBinding): boolean =>
  allModifiersSatisfied(event, binding.modifiers);
