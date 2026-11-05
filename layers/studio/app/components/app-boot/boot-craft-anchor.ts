/** Shared SVG viewBox for the boot craft placeholder and custom UFO art. */
export const BOOT_CRAFT_VIEWBOX_WIDTH = 120;
export const BOOT_CRAFT_VIEWBOX_HEIGHT = 80;

/** Beam emission point in viewBox units — bottom center of the hull (#craft-body). */
export const BOOT_BEAM_ANCHOR_X = 60;
export const BOOT_BEAM_ANCHOR_Y = 50;

export const bootBeamAnchorTopPercent = (): number => (BOOT_BEAM_ANCHOR_Y / BOOT_CRAFT_VIEWBOX_HEIGHT) * 100;
