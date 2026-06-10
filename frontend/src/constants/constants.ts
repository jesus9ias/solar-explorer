/**
 * Solar Explorer — all named constants and enums.
 *
 * This module is the single home for every magic value in the codebase. No
 * other module may use an unnamed numeric or string literal that has domain
 * meaning. Placeholder numeric values defined here are finalized in Stage 4.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Supported UI languages. Values are the keys used inside config JSON. */
export enum Language {
  EN = 'en',
  ES = 'es',
}

/** Navigation / rendering modes. */
export enum Mode {
  LINEAR = 'linear',
  ELLIPSE = 'ellipse',
}

/** Distance display units. */
export enum Unit {
  MKM = 'mkm',
  AU = 'au',
}

/** Celestial body categories used in `bodies.json`. */
export enum BodyType {
  STAR = 'star',
  PLANET = 'planet',
  DWARF_PLANET = 'dwarf_planet',
  MOON = 'moon',
  ASTEROID = 'asteroid',
  COMET = 'comet',
}

/** Artificial spacecraft categories used in `spacecraft.json`. */
export enum SpacecraftType {
  SPACE_TELESCOPE = 'space_telescope',
  PROBE = 'probe',
  ROVER = 'rover',
  ORBITER = 'orbiter',
}

/** Mission status for spacecraft (and optionally bodies). */
export enum MissionStatus {
  ACTIVE = 'active',
  COMPLETE = 'complete',
  EN_ROUTE = 'en_route',
}

/** Stable identifiers for the contextual fun facts shown in Linear mode. */
export enum FunFactId {
  ASTEROID_BELT = 'asteroid_belt',
  KUIPER_BELT = 'kuiper_belt',
  HELIOPAUSE = 'heliopause',
  JOURNEY_END = 'journey_end',
}

// ---------------------------------------------------------------------------
// Scale — Linear mode
// ---------------------------------------------------------------------------

/** Maximum zoom in: 1000 px per 50 million km. */
export const ZOOM_MAX_PX_PER_MKM = 20;
/** Minimum zoom out: 1000 px per 2000 million km. */
export const ZOOM_MIN_PX_PER_MKM = 0.5;

// ---------------------------------------------------------------------------
// Scale — Ellipse mode (logarithmic orbital radii)
// ---------------------------------------------------------------------------

/** Smallest real orbital radius mapped by the log scale (Mercury). */
export const MIN_REAL_RADIUS_MKM = 57.9;
/** Largest real orbital radius mapped by the log scale (Voyager 1 approx.). */
export const MAX_REAL_RADIUS_MKM = 7375;
/** Screen radius (px) the smallest real radius maps to, at base zoom. */
export const MIN_SCREEN_RADIUS = 60;
/** Screen radius (px) the largest real radius maps to, at base zoom. */
export const MAX_SCREEN_RADIUS = 2800;

// ---------------------------------------------------------------------------
// Body rendering
// ---------------------------------------------------------------------------

/** Minimum rendered body radius so every body stays tappable. */
export const BODY_MIN_RADIUS_PX = 6;
/** Maximum rendered body radius so large bodies don't dominate. */
export const BODY_MAX_RADIUS_PX = 80;
/** Fixed illustrative radius for spacecraft and asteroids. */
export const SPACECRAFT_RADIUS_PX = 5;

// ---------------------------------------------------------------------------
// Orbital simulation
// ---------------------------------------------------------------------------

/** One Earth year equals 60 seconds of real time at 1x speed. */
export const EARTH_YEAR_MS = 60000;
/** A full revolution in radians. */
export const FULL_CIRCLE_RAD = Math.PI * 2;

/**
 * Bodies that are not in solar orbit. They are drawn at static / slowly
 * drifting positions instead of following an orbital path.
 */
export const NON_ORBITING_PROBE_IDS: readonly string[] = [
  'voyager1',
  'voyager2',
  'pioneer10',
  'pioneer11',
  'new_horizons',
];

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

/** 1 AU expressed in million kilometers. */
export const MKM_PER_AU = 149.598;

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

export const LS_KEY_LANGUAGE = 'solar_lang';
export const LS_KEY_MODE = 'solar_mode';
export const LS_KEY_UNIT = 'solar_unit';
export const LS_KEY_AUDIO = 'solar_audio';

// ---------------------------------------------------------------------------
// Preference defaults (used when no value is stored)
// ---------------------------------------------------------------------------

export const DEFAULT_LANGUAGE = Language.EN;
export const DEFAULT_MODE = Mode.LINEAR;
export const DEFAULT_UNIT = Unit.MKM;
export const DEFAULT_AUDIO_ENABLED = false;

/** Linear conversion factor from real body radius (km) to rendered px. */
export const BODY_RADIUS_PX_PER_KM = 0.0012;

/** Available orbit speed multipliers for Ellipse mode. */
export const ORBIT_SPEED_MULTIPLIERS: readonly number[] = [1, 2, 5];
/** Default orbit speed multiplier. */
export const DEFAULT_ORBIT_SPEED = 1;
/** Whether orbit lines are shown by default. */
export const DEFAULT_ORBIT_LINES_VISIBLE = true;

// ---------------------------------------------------------------------------
// Linear mode layout
// ---------------------------------------------------------------------------

/** Base render scale: pixels per million km used for vertical layout. */
export const LINEAR_PX_PER_MKM = 0.05;
/** Top padding (px) before the Sun at the start of Linear mode. */
export const LINEAR_TOP_PADDING_PX = 120;
/** Ruler tick interval in million km. */
export const RULER_TICK_INTERVAL_MKM = 250;
/** Width (px) of the left distance ruler. */
export const RULER_WIDTH_PX = 72;
/** Scroll animation duration (ms) for prev/next element jumps. */
export const ELEMENT_JUMP_DURATION_MS = 800;

// ---------------------------------------------------------------------------
// Ellipse mode layout
// ---------------------------------------------------------------------------

/** Default camera zoom in Ellipse mode. */
export const ELLIPSE_DEFAULT_ZOOM = 0.2;
/** Minimum / maximum camera zoom in Ellipse mode. */
export const ELLIPSE_MIN_ZOOM = 0.05;
export const ELLIPSE_MAX_ZOOM = 4;
/** Zoom step applied per wheel notch. */
export const ELLIPSE_ZOOM_STEP = 0.1;
/** Screen radius (px) used to place non-orbiting probes from the Sun. */
export const PROBE_STATIC_RADIUS_PX = 2900;

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/** Ambient track sources (OGG primary, MP3 fallback) under public/. */
export const AUDIO_SRC_OGG = '/audio/ambient.ogg';
export const AUDIO_SRC_MP3 = '/audio/ambient.mp3';
/** Ambient loop volume (0..1). */
export const AUDIO_VOLUME = 0.4;

// ---------------------------------------------------------------------------
// Theme (space-mission-control aesthetic)
// ---------------------------------------------------------------------------

export const COLOR_BG = '#05080f';
export const COLOR_PANEL = '#0b1320';
export const COLOR_ACCENT_GREEN = '#3df29b';
export const COLOR_ACCENT_AMBER = '#f2b134';
export const COLOR_TEXT = '#cfe3df';
export const COLOR_BORDER = '#1d3242';
export const COLOR_ORBIT_LINE = '#1d3a4a';

// ---------------------------------------------------------------------------
// Phaser scene keys, registry keys and event names
// ---------------------------------------------------------------------------

export const SCENE_LINEAR = 'LinearScene';
export const SCENE_ELLIPSE = 'EllipseScene';

export const REGISTRY_ON_SELECT = 'onSelect';

export const EVENT_LINEAR_PREV = 'linear:prev';
export const EVENT_LINEAR_NEXT = 'linear:next';
export const EVENT_ELLIPSE_SPEED = 'ellipse:speed';
export const EVENT_ELLIPSE_LINES = 'ellipse:lines';
export const EVENT_LANG_CHANGED = 'app:lang';
export const EVENT_UNIT_CHANGED = 'app:unit';

// ---------------------------------------------------------------------------
// Implementation stubs
// ---------------------------------------------------------------------------

/**
 * Message thrown by Stage 3 stubs. Every stub throws this until its real
 * implementation lands in Stage 4. Removed once all stubs are replaced.
 */
export const NOT_IMPLEMENTED_MESSAGE = 'Not implemented';
