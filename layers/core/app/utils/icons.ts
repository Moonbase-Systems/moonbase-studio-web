export type SemanticIconTheme = 'success' | 'info' | 'warning' | 'error' | 'critical';

const FILL_SEMANTIC_ICONS_MAP: Record<SemanticIconTheme, string> = {
  success: 'material-symbols:check-circle',
  info: 'material-symbols:info-rounded',
  warning: 'material-symbols:warning-rounded',
  error: 'material-symbols:error-circle-rounded',
  critical: 'mdi:close-octagon',
} as const;

const OUTLINE_SEMANTIC_ICONS_MAP: Record<SemanticIconTheme, string> = {
  success: 'material-symbols:check-circle-outline-rounded',
  info: 'material-symbols:info-outline-rounded',
  warning: 'material-symbols:warning-outline-rounded',
  error: 'material-symbols:error-outline-rounded',
  critical: 'mdi:close-octagon-outline',
} as const;

type IconVariant = 'fill' | 'outline';

export function getSemanticIconName(theme: SemanticIconTheme, variant: IconVariant = 'fill'): string {
  if (variant === 'fill') {
    return FILL_SEMANTIC_ICONS_MAP[theme];
  }

  return OUTLINE_SEMANTIC_ICONS_MAP[theme];
}
