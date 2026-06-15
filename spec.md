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

Solar Explorer is a frontend-only educational web application that lets users navigate and explore a scale representation of the solar system. It has three interactive modes — Linear, Ellipse and Mission — and covers all major celestial bodies, natural satellites, artificial satellites, dwarf planets, notable asteroids, comets, and deep-space probes, from the Sun out to Voyager 1. Mission mode replays a single spacecraft's itinerary (launch to final destination) on the shared orbital map.

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
│   ├── missions.json        # Mission-mode itineraries: phases + copy (EN + ES)
│   ├── funfacts.json        # Contextual notes for Linear mode (EN + ES)
│   └── ui.json              # All user-facing UI strings (EN + ES)
├── constants/
│   └── constants.ts         # All named constants and enums — zero magic values
├── state/
│   ├── NavigationState.ts   # Current position — in memory only
│   ├── UserPreferences.ts   # Switches + selected mission/restart — persisted to localStorage
│   ├── ScaleState.ts        # Current scale unit and zoom level
│   ├── ModeState.ts         # Current mode (Linear | Ellipse | Mission)
│   └── MissionState.ts      # Active mission runtime (status, elapsed)
├── logic/
│   ├── scale.ts             # Scale and coordinate conversion functions
│   ├── orbit.ts             # Orbital position calculations
│   ├── phases.ts            # Heliocentric transfer-arc geometry (shared)
│   ├── mission.ts           # Non-cyclic mission timeline
│   ├── i18n.ts              # Language resolution helper
│   ├── library.ts           # Library tree builder
│   └── missions.ts          # Mission data loader/lookup
├── game/
│   ├── scenes/
│   │   ├── OrbitalMapScene.ts # Abstract base: shared heliocentric map
│   │   ├── LinearScene.ts   # Phaser Scene for Linear mode
│   │   ├── EllipseScene.ts  # Phaser Scene for Ellipse mode
│   │   └── MissionScene.ts  # Phaser Scene for Mission mode
│   ├── objects/
│   │   ├── CelestialBody.ts # Phaser GameObject for planets, moons, dwarf planets
│   │   ├── Spacecraft.ts    # Phaser GameObject for probes and satellites
│   │   ├── OrbitLine.ts     # Elliptical orbit line renderer
│   │   └── SunArrow.ts      # Always-pointing-to-Sun compass arrow
│   └── renderers/
│       ├── BodyRenderer.ts  # Procedural canvas drawing for each body type
│       └── RulerRenderer.ts # Left-side distance counter for Linear mode
├── ui/
│   ├── LibraryModal.ts      # Two-column modal: element list + info + go-to
│   ├── MissionModal.ts      # Two-column modal: mission list + plan + start
│   ├── MissionPanel.ts      # Mission HUD overlay: years counter + phase checklist
│   ├── InfoView.ts          # Embeddable per-element info panel (preview + data)
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
| Mode | Switch | Linear / Ellipse / Mission | localStorage |
| Distance unit | Switch | MKm / AU | localStorage |
| Audio | Switch | On / Off | localStorage |
| Selected mission | (Mission mode) | one of the missions in `missions.json` | localStorage |
| Mission restart | (Mission mode) | Manual / Auto | localStorage |

All switch state reads from `UserPreferences` on init. On change: update `UserPreferences`, update `localStorage`, notify relevant subscribers.

### Library Modal

A single modal merges the element library and the per-element information into
two columns. It is reached two ways:

1. **The HUD Library button** — opens with no preselection; the info column
   shows a placeholder.
2. **Selecting any celestial body or spacecraft** in either mode — opens with
   that element's information shown directly.

**Left column — browse**

- A search input that filters the list by name (case- and accent-insensitive).
- A "group by" selector with two modes:
  - **Type** (default): Star, Planets, Dwarf Planets, Natural Satellites,
    Artificial Spacecraft, Asteroids & Comets.
  - **Orbits** (the body each item orbits): the Sun first (every solar-orbiting
    body and the Sun itself), then each planet that hosts moons or spacecraft
    ordered by its distance from the Sun, and finally interstellar probes.
- The grouped, clickable list of every element. Completed missions are flagged
  with a `✦`. Group headings are labels only — not clickable.

**Right column — information**

Shows the selected element (or a placeholder when nothing is selected):

- Name (localized)
- Procedural image of the body (rendered on a `<canvas>`), or a photo when one
  is configured
- Distance to Sun (in current unit: Million km or AU)
- Orbital period (years to orbit the Sun, or host planet if it is a moon)
- Rotation period (days for a full self-rotation)
- Surface / atmospheric temperature range
- Additional facts (localized, from JSON)
- For artificial spacecraft: mission objectives and main instrument descriptions
- A **"Close and go to element"** button (only while an element is selected)
  that closes the modal and flies the active scene to that element's current
  position.

Not all fields apply to every element. Missing fields are omitted, not shown as
empty. For completed missions a "Mission complete" badge is displayed with the
mission end date.

**General**

- Closes via the close (×) button, a click outside the modal, or the `Esc` key.
- On desktop both columns are always visible. On mobile the columns collapse
  into tabs (List / Info); opening via the Library button defaults to the List
  tab, while opening by selecting an element defaults to the Info tab.

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

### Distance Counter

A small box fixed at the vertical center of the viewport's left edge. It shows the distance traveled from the Sun in the current unit (MKm or AU), quantized so it ticks over like an odometer as the user scrolls. Inside the box, fine lines scroll past like a turning knob to convey motion; nothing else is drawn down the left edge. The readout recolors by distance zone (inner system → outer planets → Kuiper belt → interstellar), and the asteroid-belt seam is flagged in amber inside the box only while it passes through.

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

## Mission Mode

Mission mode replays a single spacecraft's itinerary on the same heliocentric
map as Ellipse mode (shared base scene: Sun at the origin, planets and moons
orbiting, pan/zoom camera, compass arrow). The selected craft cruises along
heliocentric transfer arcs between anchors, orbits an anchor during station-
keeping/survey phases, and ends at its final anchor — a planet, Earth, or its
current known position. Other spacecraft are hidden so the mission reads clearly.

### Itinerary data (missions.json)

Each mission references a spacecraft by id (reusing its name/image/objectives)
and adds the Mission-mode itinerary and copy:

```jsonc
{
  "id": "voyager1",
  "spacecraftId": "voyager1",
  "durationYears": 47.3,            // equals the sum of phase durations
  "phases": [
    { "from": "earth", "to": "jupiter", "durationYears": 1.5,
      "en": { "label": "Cruise to Jupiter" }, "es": { "label": "Crucero a Júpiter" } },
    { "from": "saturn", "to": "self", "durationYears": 44.1,
      "en": { "label": "Escape toward interstellar space" }, "es": { "label": "..." } }
  ],
  "en": { "name": "Voyager 1", "summary": "...", "highlights": ["..."] },
  "es": { ... }
}
```

- `from`/`to` are solar-orbiting body ids. `from === to` is a station-keeping leg.
- The final `to` may be `"self"` — the craft's current known position (an escape
  probe's endpoint, consistent with its static position in Ellipse mode).
- Durations are realistic (Voyager spans ~47 years), conveying the magnitude of
  the journeys; the elapsed-years counter shows one decimal.

### Behavior

- Entering Mission mode opens the mission picker modal immediately — choosing a
  mission is mandatory. Opening the picker mid-mission does not stop the running
  mission; starting a different one resets the scene to that itinerary.
- The orbit-speed control (pause / 1× / 2× / 5×) pauses or advances the mission
  and the bodies together.
- A per-phase progress checklist fills in as phases complete (illustrative only).
- Mission trajectory lines have their own show/hide toggle and color, separate
  from Ellipse orbit lines.
- On completion the scene freezes (restart mode **Manual**, default) or snaps
  every element back to its base position and replays (restart mode **Auto**).
- The timeline is non-cyclic: it has a clear start and end (see `logic/mission.ts`).

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

  Scenario: Switch to Mission mode
    Given the user is in any mode
    When the user switches to Mission mode
    Then the Mission scene loads
    And the mission picker modal opens immediately

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
    And the distance counter in Linear mode updates
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

### Feature: Library Modal

```gherkin
Feature: Library Modal
  As a user
  I want a single modal that lets me browse every element and read its details
  So that I can find any element and jump to it

  Scenario: Open from the Library button
    Given the app is loaded
    When the user clicks the Library button
    Then the modal opens with the element list grouped by type
    And the information column shows a placeholder

  Scenario: Open by selecting an element in Linear mode
    Given the user is in Linear mode
    When the user clicks on a celestial body
    Then the modal opens showing that body's name, image, and data fields
    And fields not applicable to the body type are not shown

  Scenario: Open by selecting an element in Ellipse mode
    Given the user is in Ellipse mode
    When the user clicks on a celestial body
    Then the same modal opens with the same content

  Scenario: Search elements by name
    Given the modal is open
    When the user types into the search box
    Then the list shows only elements whose name matches, ignoring case and accents
    And groups with no matching element are hidden

  Scenario: Group by orbited body
    Given the modal is open
    When the user selects the "Orbits" grouping
    Then solar-orbiting bodies are grouped under the Sun
    And each moon and host-orbiting spacecraft is grouped under the body it orbits
    And interstellar probes are grouped on their own

  Scenario: Navigate to an element from the list
    Given the modal is open with an element selected
    When the user clicks "Close and go to element"
    Then the modal closes
    And the active scene moves to that element's current position

  Scenario: Mission complete badge
    Given a spacecraft with missionStatus "complete"
    When the user views it in the information column
    Then a "Mission complete" badge is shown with the end year

  Scenario: Close the modal
    Given the modal is open
    When the user clicks the close button, clicks outside it, or presses Esc
    Then the modal closes and the scene is interactive again

  Scenario: Columns become tabs on mobile
    Given the viewport is narrow
    When the modal opens via the Library button
    Then the List and Info columns are shown as tabs with List active
    And opening by selecting an element activates the Info tab instead
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
    And the distance counter updates

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

  Scenario: Pause orbital simulation
    Given the simulation is running at any speed
    When the user presses the pause button (||)
    Then all bodies stop moving
    And the pause button is shown as active in the orbit speed control

  Scenario: Resume from pause
    Given the simulation is paused
    When the user selects a speed (1x, 2x or 5x)
    Then all bodies resume orbiting at the selected speed

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

  Scenario: Moons and satellites clear their host
    Given a host body is drawn at an exaggerated size in Ellipse mode
    When its moons and host-orbiting spacecraft are placed
    Then each orbits on its own concentric ring outside the host's rendered disc
    And no two of them share a ring
```

### Feature: Mission mode

```gherkin
Feature: Mission mode
  As a user
  I want to replay a single spacecraft's mission from launch to its destination
  So that I can grasp the route and the decades these journeys take

  Scenario: Choosing a mission is mandatory
    Given the user switches to Mission mode
    Then the mission picker modal opens immediately
    And the scene waits until a mission is started

  Scenario: Start a mission
    Given the mission picker is open
    When the user selects a mission and clicks Start
    Then the scene resets and the craft begins its itinerary from the start
    And the elapsed-years counter runs
    And the phase checklist fills in as each phase completes

  Scenario: Round-trip itinerary
    Given OSIRIS-REx is running
    Then it cruises to Bennu on a heliocentric arc
    And it orbits Bennu during the survey phase rather than sitting on top of it
    And it returns along an arc to Earth
    And its anchor bodies keep orbiting the Sun throughout

  Scenario: One-way itinerary
    Given BepiColombo is running
    Then it cruises inward and ends in orbit around Mercury, never returning to Earth

  Scenario: Escape itinerary ends at the current position
    Given an escape probe (Voyager, Pioneer or New Horizons) is running
    Then it flies past its planets and coasts out to its current known position
    And the elapsed-years counter spans decades

  Scenario: Completion freezes the scene
    Given a mission reaches its end with restart mode Manual
    Then the whole scene freezes in place

  Scenario: Automatic restart
    Given a mission reaches its end with restart mode Auto
    Then every element snaps back to its base position and the itinerary replays

  Scenario: Pause and speed
    Given a mission is running
    When the user presses pause or selects 1x, 2x or 5x
    Then the mission and the bodies pause or advance accordingly

  Scenario: Mission lines toggle
    Given the mission trajectory is visible
    When the user toggles Mission lines off
    Then the trajectory overlay hides, independently of the orbit-lines toggle

  Scenario: Opening the picker mid-mission
    Given a mission is in progress
    When the user opens the mission modal
    Then the running mission continues until the user starts a different one
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
    And the counter marks the belt where the scale rate changes
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

### phases.test.ts (heliocentric transfer-arc geometry)

| Test | Input | Expected output |
|---|---|---|
| `phasePoint` returns start/end at t=0 / t=1 | endpoints | `from` / `to` |
| `phasePoint` blends solar distance between orbits | same-angle endpoints | mid radius on the axis |
| `phasePoint` keeps the arc clear of the Sun | opposite-side anchors | every sample stays at the orbit radius, never near origin |
| `phasePoint` sweeps prograde, never retreating | `to` just clockwise of `from` | first moves forward (positive y) |
| `phasePoint` collapses when endpoints coincide | `from === to` | shared anchor |

### mission.test.ts (non-cyclic timeline)

| Test | Input | Expected output |
|---|---|---|
| `missionDurationYears` sums phase durations | itinerary | total years |
| `missionProgressAt` starts in first phase at t=0 | `elapsed=0` | `{index:0, t:0, done:false}` |
| `missionProgressAt` reports intra-phase fraction | mid-phase elapsed | `t` in `(0,1)` |
| `missionProgressAt` boundary belongs to next phase | `elapsed = phase0 duration` | next phase at `t=0` |
| `missionProgressAt` clamps and marks done at/after the end | `elapsed >= total` | final phase, `t=1`, `done:true` (no loop) |
| `completedPhaseCount` lights phases as their end is reached | various elapsed | count of fully completed phases |
| `missionElapsedYears` / `formatElapsedYears` | elapsed ms | years value / `"NN.N"` |

### missions.test.ts (config integrity)

| Test | Input | Expected output |
|---|---|---|
| roster matches the agreed set | `missions.json` | OSIRIS-REx, BepiColombo, Voyager 1/2, Pioneer 10/11, New Horizons |
| each mission references a real spacecraft | `spacecraftId` | exists in `spacecraft.json` |
| anchors are real solar bodies or `self` | every phase | valid `from`/`to`; `self` only as the final `to` |
| `durationYears` equals the phase sum; endpoints | each mission | OSIRIS→Earth, Bepi→Mercury, escape→`self` |

### missionstate.test.ts

| Test | Input | Expected output |
|---|---|---|
| UserPreferences persists mission id + restart mode | set values | read back on a new instance |
| `MissionState.start/restart` resets elapsed and runs | start(id) | status running, elapsed 0, selection persisted |
| `MissionState.complete` marks the mission finished | complete() | status complete |

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
| `buildGroupsByHost` groups solar-orbiting bodies under the Sun | all JSONs | Sun group contains earth, ceres, sun |
| `buildGroupsByHost` groups moons under their host | all JSONs | Jupiter group contains io |
| `buildGroupsByHost` groups host-orbiting craft under their host | all JSONs | Saturn group contains cassini |
| `buildGroupsByHost` groups interstellar probes apart | all JSONs | interstellar group contains voyager1 |
| `buildGroupsByHost` orders Sun first, interstellar last | all JSONs | first key `sun`, last key `interstellar` |
| `filterLibraryItems` matches case/accent-insensitively | items + query | matching items only; empty query returns all |

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
22. `ui/InfoView.ts`
23. `ui/LibraryModal.ts`
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