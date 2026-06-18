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
  MISSION = 'mission',
}

/**
 * What happens when a mission reaches its end. MANUAL freezes the whole scene
 * (the default); AUTO resets every element to its base position and replays the
 * itinerary from the start.
 */
export enum MissionRestartMode {
  MANUAL = 'manual',
  AUTO = 'auto',
}

/** Runtime state of the active mission timeline (in-memory; not persisted). */
export enum MissionRunState {
  /** No mission is playing (e.g. just entered the mode, modal open). */
  IDLE = 'idle',
  /** A mission is playing (advancing, or paused via the speed control). */
  RUNNING = 'running',
  /** The mission reached its final anchor; the scene is frozen. */
  COMPLETE = 'complete',
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

// ---------------------------------------------------------------------------
// Scale — Linear mode
// ---------------------------------------------------------------------------

/** Maximum zoom in: 1000 px per 50 million km. */
export const ZOOM_MAX_PX_PER_MKM = 20;
/** Minimum zoom out: 1000 px per 2000 million km. */
export const ZOOM_MIN_PX_PER_MKM = 0.5;

// ---------------------------------------------------------------------------
// Scale — Ellipse mode (linear orbital radii)
// ---------------------------------------------------------------------------

/** Smallest real orbital radius mapped by the linear scale (Mercury). */
export const MIN_REAL_RADIUS_MKM = 57.9;
/** Largest real orbital radius mapped by the linear scale (Neptune). */
export const MAX_REAL_RADIUS_MKM = 4500;
/**
 * Screen radius (px) the smallest real radius (Mercury) maps to, at base zoom.
 * Sized so Mercury clears the enlarged Sun ({@link SUN_ELLIPSE_SCALE}); the inner
 * planets then spread out instead of crowding the star.
 */
export const MIN_SCREEN_RADIUS = 200;
/**
 * Screen radius (px) the largest real radius (Neptune) maps to, at base zoom.
 * The whole map is intentionally large (~2.5× the inner-only view) so true
 * distance proportions read at a human scale: the outer planets sit off the
 * default view and the user pans/zooms out to reach them.
 */
export const MAX_SCREEN_RADIUS = 7000;

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
// Pointer interaction (tap vs. drag, body hit areas)
// ---------------------------------------------------------------------------

/**
 * Padding factor enlarging a body's hit area beyond its rendered disc so small
 * bodies stay tappable. Capped by {@link HIT_PADDING_MAX_PX} so it never inflates
 * a large body's hit area into neighboring orbits.
 */
export const HIT_RADIUS_FACTOR = 1.4;
/** Floor for a body's hit radius (px) so even the tiniest bodies are tappable. */
export const MIN_HIT_RADIUS_PX = 8;
/**
 * Maximum padding (px, in the body's own texture space) the hit area may add
 * beyond the rendered disc. Keeps a large, scaled body (the Sun) from claiming
 * empty space past the nearest orbit — clicks beyond Mercury must miss the Sun.
 */
export const HIT_PADDING_MAX_PX = 6;
/**
 * Maximum pointer travel (px) from press to release still counted as a tap
 * (element selection). Beyond this the gesture is a pan/pinch and must not open
 * an element's info — the long-standing "I tried to drag but opened info" bug.
 */
export const TAP_MAX_MOVE_PX = 8;

// ---------------------------------------------------------------------------
// Orbital simulation
// ---------------------------------------------------------------------------

/** One Earth year equals 60 seconds of real time at 1x speed. */
export const EARTH_YEAR_MS = 60000;
/** A full revolution in radians. */
export const FULL_CIRCLE_RAD = Math.PI * 2;
/** Degrees-to-radians factor (one home for the conversion). */
export const DEG_TO_RAD = Math.PI / 180;

/** The J2000.0 epoch (2000 Jan 1, 12:00 TT) as a Unix timestamp in ms. The
 * reference epoch the body mean longitudes below are quoted at. */
export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
/** Length of a Julian year (365.25 days) in ms — the unit mean longitudes use. */
export const MS_PER_JULIAN_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Mean heliocentric ecliptic longitude (degrees) at the J2000 epoch, per body.
 * Source: JPL Keplerian elements for the major planets (Standish, valid
 * 1800–2050), the approximate elements for Pluto, and (101955) Bennu's elements
 * propagated from their 2011 epoch back to J2000. Combined with each body's
 * orbital period these seed Mission mode at the historical configuration for a
 * mission's launch date, so transfer arcs look like the real diagrams instead
 * of starting from arbitrary positions. Bodies absent here fall back to a
 * deterministic spread. See {@link heliocentricAngleAt}.
 */
export const BODY_MEAN_LONGITUDE_J2000_DEG: Readonly<Record<string, number>> = {
  mercury: 252.25032350,
  venus: 181.97909950,
  earth: 100.46457166,
  mars: 355.44656795,
  jupiter: 34.39644051,
  saturn: 49.95424423,
  uranus: 313.23810451,
  neptune: 304.87997031,
  pluto: 238.92903833,
  bennu: 97.77,
};

/**
 * Heliocentric ecliptic longitude (degrees) of each interstellar probe's escape
 * direction — the bearing of its `self` anchor, so the final coast points the
 * real way out of the system instead of an arbitrary direction. Derived by
 * projecting each craft's known RA/Dec heading onto the ecliptic plane (the 2D
 * map ignores the out-of-ecliptic component). Probes absent here fall back to a
 * deterministic spread.
 */
export const INTERSTELLAR_ESCAPE_LONGITUDE_DEG: Readonly<Record<string, number>> = {
  voyager1: 257.0,
  voyager2: 289.9,
  pioneer10: 79.6,
  pioneer11: 285.3,
  new_horizons: 284.5,
};

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
/** Id of the last selected mission, and the chosen restart behavior. */
export const LS_KEY_MISSION = 'solar_mission';
export const LS_KEY_MISSION_RESTART = 'solar_mission_restart';

// ---------------------------------------------------------------------------
// Preference defaults (used when no value is stored)
// ---------------------------------------------------------------------------

export const DEFAULT_LANGUAGE = Language.EN;
export const DEFAULT_MODE = Mode.ELLIPSE;
export const DEFAULT_UNIT = Unit.MKM;
export const DEFAULT_AUDIO_ENABLED = false;
/** No mission is preselected until the user picks one in the mission modal. */
export const DEFAULT_MISSION_ID: string | null = null;
/** Missions freeze on completion by default; auto-restart is opt-in. */
export const DEFAULT_MISSION_RESTART = MissionRestartMode.MANUAL;

/** Linear conversion factor from real body radius (km) to rendered px. */
export const BODY_RADIUS_PX_PER_KM = 0.0012;

/** Orbit speed multiplier value that represents paused state. */
export const ORBIT_SPEED_PAUSED = 0;
/** Available orbit speed multipliers for Ellipse mode (0 = paused). */
export const ORBIT_SPEED_MULTIPLIERS: readonly number[] = [0, 1, 2, 5];
/** Default orbit speed multiplier. */
export const DEFAULT_ORBIT_SPEED = 1;
/** Whether orbit lines are shown by default. */
export const DEFAULT_ORBIT_LINES_VISIBLE = true;

// ---------------------------------------------------------------------------
// Linear mode layout
// ---------------------------------------------------------------------------

/** Base render scale: pixels per million km used for vertical layout. */
export const LINEAR_PX_PER_MKM = 0.05;
/**
 * Distance (million km) where Linear mode switches from the expanded inner scale
 * to the base outer scale — the asteroid belt, between Mars and Jupiter. The four
 * inner planets span <1% of the journey at one uniform scale, so they are drawn
 * at an expanded rate up to this seam (see {@link LINEAR_INNER_EXPANSION}); the
 * outer system keeps the base zoom rate, so it looks exactly as it would without
 * the seam, just shifted down by the inner expansion.
 */
export const LINEAR_SCALE_SEAM_MKM = 414;
/**
 * Factor by which the inner zone (inside {@link LINEAR_SCALE_SEAM_MKM}) is
 * expanded relative to the base outer rate. The scale stays linear within each
 * zone; only the rate changes at the seam.
 */
export const LINEAR_INNER_EXPANSION = 3;
/** Top padding (px) before the Sun at the start of Linear mode. */
export const LINEAR_TOP_PADDING_PX = 120;
/**
 * Clear space (px) kept between the rendered discs of consecutive elements in
 * Linear mode. Moon→planet distances are 2–3 orders of magnitude smaller than the
 * interplanetary spacing, so at one shared linear scale satellites render on top
 * of their host. After computing true-to-scale positions, a declutter pass pushes
 * overlapping elements down so each disc clears the previous one's by this margin
 * (plus a label's height), keeping every element visible and selectable.
 */
export const LINEAR_BODY_GAP_PX = 16;
// ---------------------------------------------------------------------------
// Linear-mode distance counter
// ---------------------------------------------------------------------------

/**
 * The Linear-mode readout is a small box fixed at the viewport's vertical center
 * on the left edge. It reports the distance at the viewport center, quantized to
 * these steps so it ticks over like an odometer. Inside the box, fine lines
 * scroll past like a turning knob to convey motion; nothing else is drawn down
 * the left edge.
 */
export const COUNTER_STEP_MKM = 10;
export const COUNTER_STEP_AU = 0.1;
/**
 * Counter box geometry (px). The box is flush against the left screen edge: its
 * left side has no border and only the right corners are rounded, so it reads as
 * a tab protruding from the edge rather than a floating panel.
 */
export const COUNTER_BOX_W = 82;
export const COUNTER_BOX_H = 64;
export const COUNTER_BOX_RADIUS = 10;
/** Spacing (px) of the knob lines that scroll inside the box. */
export const COUNTER_KNOB_SPACING_PX = 9;
/**
 * Zone boundaries (million km) that recolor the counter as the journey grows
 * more extreme. The inner boundary reuses the asteroid-belt seam so the color
 * change also marks the belt; the others sit at Neptune's orbit (the edge of
 * the planetary system / start of the Kuiper belt) and the heliopause (the edge
 * of the Sun's influence / interstellar space).
 */
export const COUNTER_ZONE_INNER_MAX_MKM = LINEAR_SCALE_SEAM_MKM;
export const COUNTER_ZONE_OUTER_MAX_MKM = 4495;
export const COUNTER_ZONE_KUIPER_MAX_MKM = 18000;
/** Scroll animation duration (ms) for prev/next element jumps. */
export const ELEMENT_JUMP_DURATION_MS = 800;

/**
 * Keyboard arrow-key navigation speed, in screen pixels per second. Linear mode
 * uses it to scroll (up/down only); the orbital map (Ellipse and Mission) uses
 * it to pan the camera in all four directions, dividing by zoom so the on-screen
 * pan rate stays constant regardless of how far the camera is zoomed.
 */
export const KEYBOARD_PAN_SPEED_PX = 600;

/**
 * Keyboard +/- zoom rate for the orbital map (Ellipse and Mission), as the
 * multiplicative factor the camera zoom reaches after holding the key for one
 * full second. Applied frame-by-frame as `factor^(delta/1000)` so the zoom
 * speed is smooth and frame-rate independent.
 */
export const KEYBOARD_ZOOM_FACTOR_PER_SEC = 2.5;
/**
 * Key codes for the +/- zoom controls — both the main number row and the numpad,
 * so either '+'/'-' works. 187/189 are the unshifted '='/'-' keys (Shift makes
 * them '+'/'_'), which is how a user presses '+'/'-' on most layouts.
 */
export const KEY_CODE_EQUALS = 187;
export const KEY_CODE_MINUS = 189;
export const KEY_CODE_NUMPAD_ADD = 107;
export const KEY_CODE_NUMPAD_SUBTRACT = 109;

// ---------------------------------------------------------------------------
// Ellipse mode layout
// ---------------------------------------------------------------------------

/**
 * Display scale applied to the Sun in Ellipse mode only (its procedural texture
 * is shared with Linear mode, so this scales the on-screen object, not the
 * texture). Makes the Sun ~2× Jupiter so the star clearly dominates the map.
 */
export const SUN_ELLIPSE_SCALE = 2;
/** Default camera zoom in Ellipse mode (frames the inner system on load). */
export const ELLIPSE_DEFAULT_ZOOM = 0.4;
/** Minimum / maximum camera zoom in Ellipse mode. */
export const ELLIPSE_MIN_ZOOM = 0.05;
export const ELLIPSE_MAX_ZOOM = 4;
/** Zoom step applied per wheel notch. */
export const ELLIPSE_ZOOM_STEP = 0.1;
/**
 * Clear space (px) between a host's rendered disc and its moons/satellites, and
 * between consecutive orbiter rings. Bodies are size-exaggerated to stay visible,
 * so a fixed orbit radius lands inside a giant's disc; orbiters are instead given
 * concentric rings that clear the disc (see logic/orbitRings).
 */
export const ELLIPSE_ORBIT_GAP_PX = 16;
/**
 * Visual orbital period (Earth years) for moons and host-orbiting spacecraft in
 * Ellipse mode. Their real periods are days, which at 1 year = 60 s render as
 * sub-second, dizzying spins; the 86× spread between the fastest and slowest moon
 * makes a faithful proportion unusable, so they share one calm tunable period.
 * Lower = faster. The global speed multiplier (1x/2x/5x) still applies on top.
 */
export const ELLIPSE_ORBITER_PERIOD_YEARS = 0.2;
/**
 * Default speed factor for the innermost / outermost orbiter ring around a host.
 * A factor multiplies angular speed (period = base / factor), so inner moons run
 * faster than outer ones for a livelier, system-like look — purely cosmetic. A
 * per-object `speedFactor` in the JSON data overrides this default.
 */
export const ELLIPSE_ORBITER_SPEED_INNER = 1.8;
export const ELLIPSE_ORBITER_SPEED_OUTER = 0.8;

// ---------------------------------------------------------------------------
// Mission mode
// ---------------------------------------------------------------------------

/**
 * Reference epoch (year) for the "current known position" anchor (`self`) of
 * escape probes. A mission's final leg cruises from its last flyby out to where
 * the probe is estimated to be at this epoch, then freezes — conveying how many
 * decades the journey has taken.
 */
export const MISSION_CURRENT_EPOCH_YEAR = 2025;
/** Anchor token a mission phase uses for the craft's own current position. */
export const MISSION_SELF_ANCHOR = 'self';
/** Decimal places shown by the mission years counter. */
export const MISSION_YEARS_DECIMALS = 1;
/** Mission trajectory line color — amber, distinct from the orbit-line blues. */
export const COLOR_MISSION_LINE = '#f2b134';

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

/**
 * Distance-counter zone colors, brightening into colder/edge-of-known hues as
 * the journey leaves the planetary system. See COUNTER_ZONE_*_MKM.
 */
export const COLOR_ZONE_INNER = COLOR_ACCENT_GREEN;
export const COLOR_ZONE_OUTER = '#4fd2e0';
export const COLOR_ZONE_KUIPER = '#b07cff';
export const COLOR_ZONE_INTERSTELLAR = '#ff5d73';

export const ORBIT_LINE_COLORS: Readonly<Record<string, string>> = {
  planet:        '#2a7fb5',
  dwarf_planet:  '#4a5bb5',
  moon:          '#4a5568',
  asteroid:      '#7a4a1a',
  comet:         '#1a8a8a',
  space_telescope: '#1a7a4a',
  probe:         '#8a6a1a',
  orbiter:       '#8a6a1a',
  rover:         '#8a6a1a',
};

// ---------------------------------------------------------------------------
// Phaser scene keys, registry keys and event names
// ---------------------------------------------------------------------------

export const SCENE_LINEAR = 'LinearScene';
export const SCENE_ELLIPSE = 'EllipseScene';
export const SCENE_MISSION = 'MissionScene';

export const REGISTRY_ON_SELECT = 'onSelect';

export const EVENT_LINEAR_PREV = 'linear:prev';
export const EVENT_LINEAR_NEXT = 'linear:next';
export const EVENT_ELLIPSE_SPEED = 'ellipse:speed';
export const EVENT_ELLIPSE_LINES = 'ellipse:lines';
export const EVENT_LANG_CHANGED = 'app:lang';
/** Focus the camera/scroll on a specific element by id (payload: string id). */
export const EVENT_FOCUS_ELEMENT = 'app:focus';
/** Mission-mode controls. Speed reuses the orbit-speed multipliers (0 = pause). */
export const EVENT_MISSION_SPEED = 'mission:speed';
export const EVENT_MISSION_LINES = 'mission:lines';
/** Restart the active mission now (payload: none). */
export const EVENT_MISSION_RESTART = 'mission:restart';
/** Begin a freshly selected mission by id (payload: string id). */
export const EVENT_MISSION_START = 'mission:start';

// ---------------------------------------------------------------------------
// Implementation stubs
// ---------------------------------------------------------------------------

/**
 * Message thrown by Stage 3 stubs. Every stub throws this until its real
 * implementation lands in Stage 4. Removed once all stubs are replaced.
 */
export const NOT_IMPLEMENTED_MESSAGE = 'Not implemented';
