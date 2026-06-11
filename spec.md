# Solar Explorer — Project Specification

## Working Instructions for Claude Code

This document is the authoritative source of truth for implementing the Solar Explorer project. Read it completely before writing any code.

### How to work with this spec

- Implement one stage at a time. Do not begin a stage until the developer explicitly authorizes it.
- Confirm when a stage is complete and list what was produced.
- Do not modify source files outside the scope of the current request without developer authorization.
- Do not add, remove, or modify unit tests without developer authorization.
- Do not add code that does not make at least one existing test pass.
- Never commit sensitive values. All secrets and environment-specific parameters go in `.env` files excluded from version control.
- All source code, tests, comments, and documentation must be written in English.
- All user-visible text must come from JSON configuration files, keyed by section and language. No hardcoded strings in source.
- Separate concerns strictly: state, logic, and rendering must live in separate modules.
- No magic numbers or magic strings. Every constant must have a named `const` or `enum` in `constants.ts`.
- After completing each stage, list every file created or modified.

---

## Project Overview

Solar Explorer is a frontend-only educational web application that lets users navigate and explore a scale representation of the solar system. It has two interactive modes — Linear and Ellipse — and covers all major celestial bodies, natural satellites, artificial satellites, dwarf planets, notable asteroids, comets, and deep-space probes, from the Sun out to Voyager 1.

---

## Repository Structure

Two separate repositories inside a monorepo (or two independent repos):

```
solar-explorer/
├── infra/          # AWS CDK stack (TypeScript)
└── frontend/       # Astro application
```

---

## Technology Stack

| Concern | Technology |
|---|---|
| Frontend framework | Astro (latest stable) |
| Game engine / canvas | Phaser 4 (latest stable) |
| Logic & types | TypeScript (strict mode) |
| Glue code | Vanilla JavaScript where TypeScript is excessive |
| Infrastructure | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions |
| Hosting | S3 + CloudFront |
| DNS | Route 53 |
| Audio | OGG + MP3 fallback, sourced from NASA Audio Collection or Freesound.org (CC0) |
| Graphics | Procedural SVG/Canvas — no external image assets for celestial bodies |

---

## Repositories

### `infra/`

AWS CDK stack written in TypeScript. All environment-specific values are read from environment variables or a `.env` file that is never committed.

Configurable parameters (via environment variables):

| Parameter | Description |
|---|---|
| `DOMAIN_NAME` | e.g. `solar.example.com` |
| `HOSTED_ZONE_ID` | Route 53 Hosted Zone ID |
| `HOSTED_ZONE_NAME` | e.g. `example.com` |
| `AWS_REGION` | Default: `us-east-1` |
| `AWS_PROFILE` | AWS credentials profile name |

Provisions:

- S3 bucket (private, website hosting disabled — served only through CloudFront)
- CloudFront distribution with HTTPS, pointing to S3 origin
- ACM certificate in `us-east-1` (required by CloudFront regardless of region)
- Route 53 A record aliasing the configured domain to the CloudFront distribution

### `frontend/`

Astro application. Phaser runs inside an Astro page as a client-side canvas. Astro handles the HTML shell, global UI controls (switches, buttons in the HUD), and routing.

GitHub Actions workflow:

1. Install dependencies
2. Run unit tests — fail the workflow if any test fails
3. Build Astro (`astro build`)
4. Sync `dist/` to S3 (`aws s3 sync`)
5. Invalidate CloudFront cache (`aws cloudfront create-invalidation`)

Configurable parameters (via `.env`):

| Parameter | Description |
|---|---|
| `PUBLIC_DOMAIN` | Full domain for the app |
| `PUBLIC_CF_DISTRIBUTION_ID` | CloudFront distribution ID for cache invalidation |
| `PUBLIC_AWS_REGION` | AWS region |

---

## Architecture

### Separation of concerns

```
frontend/src/
├── config/
│   ├── bodies.json          # All celestial bodies data (EN + ES)
│   ├── spacecraft.json      # All artificial spacecraft data (EN + ES)
│   ├── funfacts.json        # Contextual notes for Linear mode (EN + ES)
│   └── ui.json              # All user-facing UI strings (EN + ES)
├── constants/
│   └── constants.ts         # All named constants and enums — zero magic values
├── state/
│   ├── NavigationState.ts   # Current position — in memory only
│   ├── UserPreferences.ts   # Switches — persisted to localStorage
│   ├── ScaleState.ts        # Current scale unit and zoom level
│   └── ModeState.ts         # Current mode (Ellipse | Linear)
├── logic/
│   ├── scale.ts             # Scale and coordinate conversion functions
│   ├── orbit.ts             # Orbital position calculations
│   ├── i18n.ts              # Language resolution helper
│   └── library.ts           # Library tree builder
├── game/
│   ├── scenes/
│   │   ├── LinearScene.ts   # Phaser Scene for Linear mode
│   │   └── EllipseScene.ts  # Phaser Scene for Ellipse mode
│   ├── objects/
│   │   ├── CelestialBody.ts # Phaser GameObject for planets, moons, dwarf planets
│   │   ├── Spacecraft.ts    # Phaser GameObject for probes and satellites
│   │   ├── OrbitLine.ts     # Elliptical orbit line renderer
│   │   └── SunArrow.ts      # Always-pointing-to-Sun compass arrow
│   └── renderers/
│       ├── BodyRenderer.ts  # Procedural canvas drawing for each body type
│       └── RulerRenderer.ts # Left-side distance ruler for Linear mode
├── ui/
│   ├── InfoModal.ts         # Click → modal overlay with body information
│   ├── LibraryPanel.ts      # Grouped tree of all elements
│   └── HUD.ts               # All switch controls and buttons
├── pages/
│   └── index.astro          # Main page shell
└── tests/
    └── *.test.ts            # Unit tests (see Test Suite section)
```

### State management rules

- `NavigationState` — held in memory (JavaScript module singleton). Lost on page reload. Shared between scenes so position is preserved when switching modes.
- `UserPreferences` — persisted to `localStorage`. Keys defined in `constants.ts`. Read on app init and written on every switch change.
- `ScaleState` and `ModeState` — in memory. Derived from `UserPreferences` on load.
- No UI component or Phaser scene reads from `localStorage` directly — they always read from the state layer.

---

## Functional Specifications

### Global Controls (HUD)

| Control | Type | Options | Persisted |
|---|---|---|---|
| Language | Switch | English / Spanish | localStorage |
| Mode | Switch | Linear / Ellipse | localStorage |
| Distance unit | Switch | MKm / AU | localStorage |
| Audio | Switch | On / Off | localStorage |

All switch state reads from `UserPreferences` on init. On change: update `UserPreferences`, update `localStorage`, notify relevant subscribers.

### Info Modal

Triggered by clicking any celestial body or spacecraft in either mode. Displays:

- Name (localized)
- Procedural image of the body (rendered on a `<canvas>` inside the modal)
- Distance to Sun (in current unit: Million km or AU)
- Orbital period (years to orbit the Sun, or host planet if it is a moon)
- Rotation period (days for a full self-rotation)
- Surface / atmospheric temperature range
- Additional facts (localized, from JSON)
- For artificial spacecraft: mission objectives and main instrument descriptions

Not all fields apply to every element. Missing fields are omitted, not shown as empty.

For completed missions: a "Mission complete" badge is displayed with the mission end date.

### Library Panel

Opened via a dedicated button in the HUD. Shows a tree grouped by category:

```
☀ Star
  Sun
🪐 Planets
  Mercury · Venus · Earth · Mars · Jupiter · Saturn · Uranus · Neptune
🔵 Dwarf Planets
  Ceres · Pluto · Eris · Makemake · Haumea
🌕 Natural Satellites
  Moon · Phobos · Deimos · Io · Europa · Ganymede · Callisto · Titan · Triton · Charon · ...
🛸 Artificial Spacecraft
  Hubble · James Webb · Parker Solar Probe · Solar Orbiter · Mars Express · Juno ·
  Voyager 1 · Voyager 2 · Pioneer 10 · Pioneer 11 · New Horizons · Cassini* ·
  Galileo* · BepiColombo · OSIRIS-REx · Perseverance
☄ Asteroids & Comets
  Vesta · Pallas · Hygiea · Halley's Comet · 67P/Churyumov-Gerasimenko
```

`*` = mission complete badge

Clicking any item opens its Info Modal.

### Position Persistence Between Modes

When the user switches mode, the current scroll/camera position is converted to a solar distance value (in the current unit) and stored in `NavigationState`. The incoming scene reads that distance and places the camera at the equivalent position in its own coordinate system.

---

## Linear Mode

### Navigation

- Scroll (mouse wheel or touchpad) moves the viewport vertically.
- Touch: single-finger drag.
- Starts at the Sun (top). Ends at Voyager 1's current estimated position.
- All elements are aligned on a single vertical axis — orbits are ignored, everything is shown in a straight line ordered by distance from the Sun.

### Controls specific to Linear mode

| Control | Behavior |
|---|---|
| "Previous element" button | Animates scroll to the previous celestial element |
| "Next element" button | Animates scroll to the next celestial element |

### Distance Ruler

A fixed ruler on the left edge of the viewport. Shows the distance traveled from the Sun in the current unit (MKm or AU). Updates continuously as the user scrolls. Tick marks at regular intervals defined in `constants.ts`.

### Fun Facts

Contextual short notes appear between elements as the user scrolls past trigger distances. Examples:

- Near the Asteroid Belt: information about the average spacing between asteroids and why collisions are rare.
- Near the Kuiper Belt: note about its difference from the Asteroid Belt.
- After Neptune: note about the heliopause and the boundary of the solar system.
- Final screen (at Voyager 1): "This is as far as we go. The Oort Cloud is approximately X AU away. Proxima Centauri is approximately Y AU away."

All fun fact text comes from `funfacts.json`, keyed by trigger element and language.

### Scale (Linear mode)

- Zoom range: 1000 px per 50 million km (maximum zoom in) to 1000 px per 2000 million km (minimum zoom out).
- The zoom level is stored in `ScaleState` and represented as a `pixelsPerMillionKm` multiplier.
- The same multiplier is used to derive the AU display: `1 AU = 149.598 million km`.

---

## Ellipse Mode

### Navigation

- Two-finger pinch or mouse wheel: zoom in/out.
- Pan: click-drag (mouse) or two-finger drag (touch).
- A compass arrow fixed to the viewport always points toward the Sun's current screen position.
- The Sun is the origin point (0, 0) of the world coordinate system.

### Controls specific to Ellipse mode

| Control | Type | Options |
|---|---|---|
| Orbit speed | Switch | 1× / 2× / 5× |
| Orbit lines | Toggle | Show / Hide |

### Orbital simulation

- Base rate: one Earth year = 60 seconds of real time at 1× speed.
- All other orbital periods are derived from this ratio using actual period values from `bodies.json`.
- Orbital positions are calculated using simplified circular/elliptical approximations (Kepler's first law, eccentricity from data). Full N-body simulation is out of scope.
- Phaser `update(time, delta)` advances each body's angle by `(delta / orbitPeriodMs) * 2π * speedMultiplier`.
- Deep-space probes not in solar orbit (Voyager 1, Voyager 2, Pioneer 10, Pioneer 11, New Horizons) are shown at their approximate static positions and do not orbit. Their positions update slowly on a separate trajectory vector.

### Orbit overlap handling

- Pluto's orbit crosses Neptune's — this is rendered correctly; their orbital radii are independent.
- Dwarf planets in the Kuiper Belt are shown with distinct orbital radii.
- Artificial satellites in near-Earth or planet-specific orbits are shown as small markers near their host body, not on full solar-system-scale orbits.

### Scale (Ellipse mode)

Orbital radii use a logarithmic scale to keep the solar system navigable:

```
screenRadius = MIN_SCREEN_RADIUS + (log(realRadius) - log(MIN_REAL_RADIUS))
             / (log(MAX_REAL_RADIUS) - log(MIN_REAL_RADIUS))
             * (MAX_SCREEN_RADIUS - MIN_SCREEN_RADIUS)
```

All four constants (`MIN_SCREEN_RADIUS`, `MAX_SCREEN_RADIUS`, `MIN_REAL_RADIUS`, `MAX_REAL_RADIUS`) are defined in `constants.ts`.

### Body sizing

- Planets are sized proportionally to each other (Jupiter ~11× Earth radius, etc.).
- A minimum rendered radius of `BODY_MIN_RADIUS_PX` (defined in `constants.ts`) ensures every body is tappable.
- A maximum rendered radius of `BODY_MAX_RADIUS_PX` prevents large bodies from dominating the view at high zoom.
- Natural satellites are proportional to their host planet with an independent min/max range.
- Artificial spacecraft and asteroids use a fixed illustrative size `SPACECRAFT_RADIUS_PX` regardless of zoom.
- At any zoom level, all bodies remain within their min/max bounds.

---

## Celestial Bodies and Spacecraft

### Planets

Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.

### Dwarf Planets

Ceres (Asteroid Belt), Pluto, Eris, Makemake, Haumea (Kuiper Belt).

### Natural Satellites

| Body | Satellites |
|---|---|
| Earth | Moon |
| Mars | Phobos, Deimos |
| Jupiter | Io, Europa, Ganymede, Callisto |
| Saturn | Titan, Enceladus, Mimas, Rhea |
| Uranus | Titania, Oberon |
| Neptune | Triton |
| Pluto | Charon |

### Artificial Spacecraft

| Name | Status | Notes |
|---|---|---|
| Hubble Space Telescope | Active | Earth orbit |
| James Webb Space Telescope | Active | L2 point |
| Parker Solar Probe | Active | Solar orbit |
| Solar Orbiter | Active | Solar orbit |
| Mars Express | Active | Mars orbit |
| Juno | Active | Jupiter orbit |
| Perseverance | Active | Mars surface |
| BepiColombo | Active (en route) | Mercury orbit insertion ~2025 |
| OSIRIS-REx | Active | Earth return trajectory |
| Voyager 1 | Active | Interstellar space |
| Voyager 2 | Active | Interstellar space |
| Pioneer 10 | Mission complete | Last contact 2003 |
| Pioneer 11 | Mission complete | Last contact 1995 |
| New Horizons | Active | Kuiper Belt |
| Cassini | Mission complete | Destroyed 2017 |
| Galileo | Mission complete | Destroyed 2003 |

### Asteroids and Comets

Vesta, Pallas, Hygiea (Asteroid Belt), Halley's Comet, 67P/Churyumov-Gerasimenko.

### Data Fields per Body (bodies.json)

```jsonc
{
  "id": "earth",
  "type": "planet",          // planet | dwarf_planet | moon | asteroid | comet
  "host": null,              // null for solar-orbiting bodies; planet id for moons
  "orbitalRadius_mkm": 149.598,
  "orbitalPeriod_years": 1.0,
  "rotationPeriod_days": 1.0,
  "radius_km": 6371,
  "eccentricity": 0.0167,
  "temperatureMin_c": -89,
  "temperatureMax_c": 57,
  "missionStatus": null,     // null | "complete"
  "missionEndYear": null,
  "en": {
    "name": "Earth",
    "description": "...",
    "facts": ["...", "..."]
  },
  "es": {
    "name": "Tierra",
    "description": "...",
    "facts": ["...", "..."]
  }
}
```

### Data Fields per Spacecraft (spacecraft.json)

```jsonc
{
  "id": "hubble",
  "type": "space_telescope",  // space_telescope | probe | rover | orbiter
  "host": "earth",            // host body for orbiting craft; null for free trajectory
  "launchYear": 1990,
  "missionStatus": "active",  // active | complete | en_route
  "missionEndYear": null,
  "orbitalRadius_mkm": 0.00057,
  "en": {
    "name": "Hubble Space Telescope",
    "objectives": "...",
    "instruments": [
      { "name": "WFC3", "description": "..." }
    ],
    "facts": ["...", "..."]
  },
  "es": { ... }
}
```

---

## Graphical Style

### Theme

Space-mission control aesthetic. All UI chrome (HUD controls, modals, panels, buttons) uses dark backgrounds, monospace or technical sans-serif fonts, subtle green/amber accent colors, and thin borders — evoking a spacecraft console.

### Celestial body rendering (procedural)

All bodies are drawn programmatically on a `<canvas>` element. No PNG or SVG image files for bodies.

| Body | Rendering approach |
|---|---|
| Sun | Radial gradient yellow→orange with animated corona pulse |
| Rocky planets (Mercury, Mars, Moon, etc.) | Gray/brown base with procedural crater dots |
| Earth | Blue base, green continent patches, white polar caps |
| Gas giants (Jupiter, Saturn, Uranus, Neptune) | Horizontal band stripes with subtle color variation |
| Saturn | Planet circle + elliptical ring drawn separately |
| Dwarf planets | Simplified gray/reddish sphere with optional surface texture |
| Asteroids / comets | Irregular dark polygon with a light tail for comets |
| Artificial spacecraft | Simple schematic SVG icon (solar panels + body shape) |

### Audio

A single looping ambient space drone track (~2–3 minutes, ≤1.5 MB). Format: `.ogg` primary, `.mp3` fallback. Stored in `public/audio/`. Sourced from NASA Audio Collection (public domain) or Freesound.org (CC0). The toggle in the HUD pauses/resumes via the Web Audio API.

---

## Internationalization

All user-visible text is sourced from JSON config files. The language toggle switches between `"en"` and `"es"` keys. The `i18n.ts` helper exposes a single function:

```typescript
getText(key: string, lang: Language): string
```

UI labels, button text, modal titles, and fun facts are all resolved through this function.

---

## Gherkin Feature Specifications

### Feature: Language switch

```gherkin
Feature: Language switch
  As a user
  I want to switch between English and Spanish
  So that I can use the app in my preferred language

  Scenario: Default language on first load
    Given the user has no saved preferences
    When the app loads
    Then the UI language is English

  Scenario: Switch to Spanish
    Given the app is displaying in English
    When the user toggles the language switch to Spanish
    Then all visible text updates to Spanish
    And the preference is saved to localStorage

  Scenario: Language preference persists on reload
    Given the user has set language to Spanish
    When the page is reloaded
    Then the app loads in Spanish
```

### Feature: Mode switch

```gherkin
Feature: Mode switch
  As a user
  I want to switch between Linear and Ellipse modes
  So that I can explore the solar system in two different ways

  Scenario: Switch from Linear to Ellipse
    Given the user is in Linear mode at a certain solar distance
    When the user switches to Ellipse mode
    Then the Ellipse scene loads with the camera centered near the equivalent solar distance
    And the mode preference is saved to localStorage

  Scenario: Switch from Ellipse to Linear
    Given the user is in Ellipse mode at a certain solar distance
    When the user switches to Linear mode
    Then the Linear scene loads with the scroll position at the equivalent solar distance

  Scenario: Mode preference persists on reload
    Given the user has set mode to Ellipse
    When the page is reloaded
    Then the Ellipse scene loads
```

### Feature: Distance unit switch

```gherkin
Feature: Distance unit switch
  As a user
  I want to display distances in Million km or AU
  So that I can understand distances in my preferred unit

  Scenario: Switch to AU
    Given the unit is set to MKm
    When the user switches to AU
    Then all distance labels update to AU values
    And the ruler in Linear mode updates
    And the preference is saved to localStorage

  Scenario: AU to Million km conversion
    Given the unit is AU
    Then 1 AU equals 149.598 million km in all calculations
```

### Feature: Audio toggle

```gherkin
Feature: Audio toggle
  As a user
  I want to turn background audio on or off
  So that I can control my experience

  Scenario: Audio defaults to off
    Given the user has no saved preference
    When the app loads
    Then audio is not playing

  Scenario: Turn audio on
    Given audio is off
    When the user toggles audio on
    Then the ambient track begins playing in a loop
    And the preference is saved to localStorage

  Scenario: Audio preference persists on reload
    Given the user has saved audio as on
    When the page is reloaded
    Then audio begins playing automatically
```

### Feature: Info Modal

```gherkin
Feature: Info Modal
  As a user
  I want to click any celestial element
  So that I can see detailed information about it

  Scenario: Open modal from Linear mode
    Given the user is in Linear mode
    When the user clicks on a celestial body
    Then a modal opens showing the body's name, image, and data fields
    And fields not applicable to the body type are not shown

  Scenario: Open modal from Ellipse mode
    Given the user is in Ellipse mode
    When the user clicks on a celestial body
    Then the same modal opens with the same content

  Scenario: Close modal
    Given a modal is open
    When the user clicks outside the modal or the close button
    Then the modal closes and the scene is interactive again

  Scenario: Mission complete badge
    Given a spacecraft with missionStatus "complete"
    When the user opens its modal
    Then a "Mission complete" badge is shown with the end year
```

### Feature: Library Panel

```gherkin
Feature: Library Panel
  As a user
  I want to browse all elements in a grouped list
  So that I can find and navigate to any element

  Scenario: Open library
    Given the app is loaded
    When the user clicks the Library button
    Then a panel opens showing all elements grouped by type

  Scenario: Navigate to element from library
    Given the library panel is open
    When the user clicks an element's name
    Then the modal for that element opens
```

### Feature: Linear mode navigation

```gherkin
Feature: Linear mode navigation
  As a user
  I want to scroll vertically through the solar system
  So that I can travel from the Sun to Voyager 1 in a straight line

  Scenario: Scroll navigation
    Given the user is in Linear mode
    When the user scrolls down
    Then the viewport moves away from the Sun
    And the distance ruler updates

  Scenario: Next element button
    Given the user is in Linear mode
    When the user clicks "Next element"
    Then the viewport animates to the next celestial element

  Scenario: Previous element button
    Given the user is in Linear mode at a position past the first element
    When the user clicks "Previous element"
    Then the viewport animates to the previous celestial element

  Scenario: Fun fact at Asteroid Belt
    Given the user scrolls to the Asteroid Belt trigger distance
    When the fun fact threshold is crossed
    Then the Asteroid Belt fun fact note appears in the scene

  Scenario: Satellites do not overlap their host
    Given a moon orbits a planet at a distance far smaller than the planet's distance from the Sun
    When the Linear scene lays out the elements
    Then the moon is pushed clear of the planet's rendered disc instead of landing inside it
    And consecutive moons stack as an even ladder below the host
    And the displacement does not shift bodies in the next cluster
```

### Feature: Ellipse mode navigation

```gherkin
Feature: Ellipse mode navigation
  As a user
  I want to zoom and pan around the orbital map
  So that I can explore planetary positions

  Scenario: Zoom in
    Given the user is in Ellipse mode
    When the user pinches inward or scrolls up
    Then the camera zooms in and bodies appear larger

  Scenario: Zoom out
    Given the user is in Ellipse mode
    When the user pinches outward or scrolls down
    Then the camera zooms out and more of the solar system is visible

  Scenario: Pan
    Given the user is in Ellipse mode
    When the user clicks and drags
    Then the camera pans in the direction of the drag

  Scenario: Sun arrow always visible
    Given the user has panned away from the Sun
    When the Sun is off screen
    Then a compass arrow appears fixed to the viewport pointing toward the Sun
```

### Feature: Orbital simulation

```gherkin
Feature: Orbital simulation
  As a user
  I want to see planets orbiting the Sun
  So that I can understand orbital mechanics

  Scenario: Orbital animation at 1x speed
    Given the simulation is running at 1x speed
    Then Earth completes one orbit in 60 seconds of real time

  Scenario: Orbital speed change
    Given the simulation is at 1x speed
    When the user switches to 5x speed
    Then all planets orbit 5 times faster

  Scenario: Orbit lines toggle
    Given orbit lines are visible
    When the user toggles orbit lines off
    Then the elliptical lines disappear and only bodies are shown

  Scenario: Non-orbiting probes
    Given Voyager 1 is included in the scene
    Then Voyager 1 does not follow an orbital path
    And it is shown at its approximate static position in interstellar space
```

### Feature: Scale system

```gherkin
Feature: Scale system
  As a user
  I want distances and sizes to be consistent and meaningful
  So that I develop accurate spatial intuition

  Scenario: Logarithmic orbital radii in Ellipse mode
    Given the Ellipse scene is loaded
    Then Neptune's screen radius is greater than Earth's screen radius
    And the ratio between them is logarithmic, not linear

  Scenario: Proportional body sizes
    Given any two planets are visible
    Then their rendered sizes are proportional to their actual radii
    And no planet is rendered below BODY_MIN_RADIUS_PX

  Scenario: Linear scale conversion
    Given the unit is MKm
    When the zoom level changes
    Then the pixels-per-million-km ratio stays within the configured min/max range

  Scenario: Piecewise scale at the asteroid belt
    Given the user is in Linear mode
    Then distances inside the asteroid belt are drawn at an expanded rate
    And distances beyond the belt keep the base zoom rate and their original spacing
    So that the inner planets get room to breathe without crowding the outer system
    And the ruler marks the belt where the scale rate changes
```

---

## Unit Test Suite

All tests live in `frontend/src/tests/`. Tests use Vitest. No test imports Phaser — Phaser scenes are tested through their logic layer only.

### scale.test.ts

| Test | Input | Expected output |
|---|---|---|
| `convertMkmToAU` converts correctly | `149.598` | `1.0` (within floating-point tolerance) |
| `convertAUToMkm` converts correctly | `1.0` | `149.598` |
| `logScale` returns MIN_SCREEN_RADIUS for smallest real radius | `MIN_REAL_RADIUS` | `MIN_SCREEN_RADIUS` |
| `logScale` returns MAX_SCREEN_RADIUS for largest real radius | `MAX_REAL_RADIUS` | `MAX_SCREEN_RADIUS` |
| `logScale` returns value between min and max for mid-range input | `realRadius in (MIN, MAX)` | `screenRadius in (MIN_SCREEN_RADIUS, MAX_SCREEN_RADIUS)` |
| `logScale` is monotonically increasing | `r1 < r2` | `logScale(r1) < logScale(r2)` |
| `pixelsPerMkm` clamps to minimum zoom | zoom value below minimum | `ZOOM_MIN_PX_PER_MKM` |
| `pixelsPerMkm` clamps to maximum zoom | zoom value above maximum | `ZOOM_MAX_PX_PER_MKM` |
| `bodyRadiusPx` respects minimum | very small real radius | `>= BODY_MIN_RADIUS_PX` |
| `bodyRadiusPx` respects maximum | very large real radius | `<= BODY_MAX_RADIUS_PX` |

### orbit.test.ts

| Test | Input | Expected output |
|---|---|---|
| `orbitAngle` for Earth at t=0 returns initial angle | `t=0, period=1yr` | `0` (or configured initial angle) |
| `orbitAngle` for Earth after 1 year (1×) returns full circle | `delta=60000ms, speed=1` | `2π` (within tolerance) |
| `orbitAngle` at 5× is 5× faster | `same delta, speed=5` | `5 × angle at speed=1` |
| `orbitAngle` for Jupiter takes ~11.86 times longer than Earth | `period=11.86yr, speed=1` | angle fraction proportional to ratio |
| Non-orbiting probes return null trajectory | `Voyager 1 body` | `isOrbiting === false` |

### state.test.ts

| Test | Input | Expected output |
|---|---|---|
| `UserPreferences` defaults — language | no localStorage | `Language.EN` |
| `UserPreferences` defaults — mode | no localStorage | `Mode.LINEAR` |
| `UserPreferences` defaults — unit | no localStorage | `Unit.MKM` |
| `UserPreferences` defaults — audio | no localStorage | `false` |
| `setLanguage` persists to localStorage | `Language.ES` | `localStorage["solar_lang"] === "es"` |
| `setMode` persists to localStorage | `Mode.ELLIPSE` | `localStorage["solar_mode"] === "ellipse"` |
| `setUnit` persists to localStorage | `Unit.AU` | `localStorage["solar_unit"] === "au"` |
| `setAudio` persists to localStorage | `true` | `localStorage["solar_audio"] === "true"` |
| `NavigationState` stores solar distance | `setDistance(149.598)` | `getDistance() === 149.598` |
| `NavigationState` is in-memory only | set value, simulate reload | value not in localStorage |
| Mode switch preserves distance | set distance, switch mode | distance unchanged in `NavigationState` |

### i18n.test.ts

| Test | Input | Expected output |
|---|---|---|
| `getText` returns English string | `key="sun.name", lang=EN` | `"Sun"` |
| `getText` returns Spanish string | `key="sun.name", lang=ES` | `"Sol"` |
| `getText` falls back to English if Spanish key missing | missing ES key | English value |
| `getText` throws if key not found in any language | unknown key | throws `I18nKeyNotFoundError` |

### library.test.ts

| Test | Input | Expected output |
|---|---|---|
| `buildLibraryTree` groups planets correctly | full bodies.json | planets array has 8 items |
| `buildLibraryTree` groups dwarf planets correctly | full bodies.json | dwarf_planets array has 5 items |
| `buildLibraryTree` marks complete missions | spacecraft.json | Cassini has `missionStatus === "complete"` |
| `buildLibraryTree` total element count matches config | all JSONs | count matches sum of all entries |

### funfacts.test.ts

| Test | Input | Expected output |
|---|---|---|
| `getFunFactsAtDistance` returns correct fact for Asteroid Belt | distance in AU triggering belt | returns asteroid belt fact object |
| `getFunFactsAtDistance` returns null before first trigger | distance 0 | `null` |
| `getFunFactsAtDistance` returns fact in correct language | `lang=ES` | Spanish text |
| `getFunFactsAtDistance` does not repeat a fact already shown | second pass at same distance | `null` (already triggered) |

---

## Implementation Stages

Each stage is implemented and completed in full before the next one begins. Claude Code will not proceed to the next stage without explicit developer authorization.

---

### Stage 1 — Infrastructure CDK Stack

**Goal:** A deployable AWS CDK stack that provisions the full hosting infrastructure.

**Deliverables:**

- `infra/` initialized as a CDK TypeScript project
- `infra/bin/solar-explorer.ts` — CDK app entry point
- `infra/lib/solar-explorer-stack.ts` — single stack defining:
  - S3 bucket (private)
  - ACM certificate (us-east-1, DNS validated)
  - CloudFront distribution (HTTPS only, S3 origin, custom domain)
  - Route 53 A alias record
- `infra/.env.example` — documents all required environment variables (never commit `.env`)
- `infra/README.md` — how to deploy (bootstrap, deploy, configure `.env`)
- All environment values injected via environment variables, never hardcoded

**Completion criteria:** `cdk synth` produces valid CloudFormation without errors.

---

### Stage 2 — Frontend Project Initialization

**Goal:** The Astro project exists with all dependencies installed. No application code yet.

**Deliverables:**

- `frontend/` initialized as an Astro project with TypeScript
- `package.json` with all dependencies:
  - `astro`, `phaser`, `typescript`, `vitest`
- `tsconfig.json` with strict mode enabled
- `astro.config.mjs` configured for static output
- `frontend/.env.example` documenting environment variables
- `frontend/src/` directory scaffolded with all folders from the Architecture section (empty files or empty directories)
- GitHub Actions workflow file (`.github/workflows/deploy.yml`) skeleton — steps defined but build/deploy commands are stubs until Stage 4
- No application logic, no components, no tests yet

**Completion criteria:** `npm install` succeeds. `npm run dev` starts the Astro dev server without errors. Project structure matches the Architecture section exactly.

---

### Stage 3 — Unit Tests (all failing)

**Goal:** All unit tests from the Test Suite section are written and all fail (because no implementation exists yet).

**Deliverables:**

- `frontend/src/tests/scale.test.ts`
- `frontend/src/tests/orbit.test.ts`
- `frontend/src/tests/state.test.ts`
- `frontend/src/tests/i18n.test.ts`
- `frontend/src/tests/library.test.ts`
- `frontend/src/tests/funfacts.test.ts`
- `frontend/src/constants/constants.ts` — all constants and enums referenced by tests must be defined (values can be placeholder numbers; the important thing is the symbols exist)
- Minimal type stubs (interfaces, no implementations) so tests compile

**Completion criteria:** `npm run test` runs all tests. Every test fails with an import error or "not implemented" error, not a syntax error or type error. Zero tests pass.

---

### Stage 4 — Implementation (tests go green)

**Goal:** All application code is written such that every test passes. No code is written that does not make at least one test pass.

**Deliverables (in dependency order):**

1. `constants/constants.ts` — all final values
2. `config/bodies.json` — all celestial bodies with EN + ES data
3. `config/spacecraft.json` — all spacecraft with EN + ES data
4. `config/funfacts.json` — all fun facts with EN + ES data
5. `config/ui.json` — all UI strings with EN + ES
6. `state/NavigationState.ts`
7. `state/UserPreferences.ts`
8. `state/ScaleState.ts`
9. `state/ModeState.ts`
10. `logic/scale.ts`
11. `logic/orbit.ts`
12. `logic/i18n.ts`
13. `logic/library.ts`
14. `game/renderers/BodyRenderer.ts`
15. `game/renderers/RulerRenderer.ts`
16. `game/objects/CelestialBody.ts`
17. `game/objects/Spacecraft.ts`
18. `game/objects/OrbitLine.ts`
19. `game/objects/SunArrow.ts`
20. `game/scenes/LinearScene.ts`
21. `game/scenes/EllipseScene.ts`
22. `ui/InfoModal.ts`
23. `ui/LibraryPanel.ts`
24. `ui/HUD.ts`
25. `pages/index.astro`
26. GitHub Actions workflow — complete deploy steps

**Completion criteria:** `npm run test` — all tests pass with zero failures. `npm run build` — Astro build succeeds with no errors. The app runs locally with both modes functional, all switches operational, all modals opening, and audio toggling correctly.

---

### Stage 5 — Documentation

**Goal:** Project documentation is complete.

**Deliverables:**

- `frontend/claude.md` — instructions for AI assistants working on this codebase:
  - Project purpose and architecture overview
  - Where state lives and how to extend it
  - How to add a new celestial body (step-by-step)
  - How to add a new spacecraft
  - How to add a new fun fact
  - How to add a new UI string
  - Test philosophy: never modify tests without developer authorization
  - Coding conventions: constants only, no magic values, logic/state/render separation
  - How to run tests and the dev server

- `frontend/README.md` — end-user and developer onboarding:
  - What the app does
  - How to run locally
  - How to deploy (references infra README)
  - How to configure `.env`
  - How to add or modify content (reference to claude.md for details)
  - Audio attribution

- `infra/README.md` — update if needed after Stage 4 finalized the deploy workflow

**Completion criteria:** Both markdown files are present, complete, accurate, and written entirely in English.

---

## Constants Reference (values to be finalized in Stage 4)

The following constants must be defined in `constants.ts`. Placeholder values are listed; final values are set during Stage 4 based on visual testing.

```typescript
// Scale — Linear mode
ZOOM_MAX_PX_PER_MKM = 20        // 1000px / 50 Mkm
ZOOM_MIN_PX_PER_MKM = 0.5       // 1000px / 2000 Mkm

// Scale — Ellipse mode
MIN_REAL_RADIUS_MKM = 57.9      // Mercury's orbital radius
MAX_REAL_RADIUS_MKM = 7375      // Voyager 1 estimated position (approximate)
MIN_SCREEN_RADIUS = 60          // px at base zoom
MAX_SCREEN_RADIUS = 2800        // px at base zoom

// Body rendering
BODY_MIN_RADIUS_PX = 6
BODY_MAX_RADIUS_PX = 80
SPACECRAFT_RADIUS_PX = 5

// Orbital simulation
EARTH_YEAR_MS = 60000           // 1 Earth year = 60 seconds at 1× speed

// Unit conversion
MKM_PER_AU = 149.598

// localStorage keys
LS_KEY_LANGUAGE = "solar_lang"
LS_KEY_MODE = "solar_mode"
LS_KEY_UNIT = "solar_unit"
LS_KEY_AUDIO = "solar_audio"
```

---

## Out of Scope

The following are explicitly excluded from this specification:

- Backend, API, or server-side rendering
- User accounts or cloud sync
- Real-time ephemeris data (NASA Horizons API or similar)
- Full N-body gravitational simulation
- Mobile app (iOS/Android native)
- Accessibility compliance beyond basic semantic HTML for the HUD

---

*End of specification.*