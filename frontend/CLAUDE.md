# CLAUDE.md — Working guide for Solar Explorer (frontend)

This file tells an AI assistant (and any developer) how to work on this
codebase. Read it fully before making changes. Everything here is normative.

> All source code, tests, comments and documentation are written in **English**.

---

## 1. Purpose

Solar Explorer is a **frontend-only**, educational web app to navigate a
scale model of the solar system. It has three interactive modes — **Linear**,
**Ellipse** and **Mission** — and covers the Sun, planets, dwarf planets, natural
satellites, artificial spacecraft, asteroids and comets, from the Sun out to
Voyager 1. Mission mode replays a single spacecraft's itinerary (e.g. Voyager 1
or OSIRIS-REx) from launch to its final destination on the shared orbital map.

The authoritative product specification is the repository-root **`spec.md`**.
This file is the *implementation* guide; `spec.md` is the *requirements*
source of truth.

---

## 2. Technology stack

| Concern | Technology |
|---|---|
| Framework | Astro (static output) |
| Game engine / canvas | Phaser 4 |
| Language | TypeScript (strict) + minimal vanilla JS glue |
| Tests | Vitest (jsdom env) |
| Graphics | Procedural canvas drawing — **no external image assets for bodies** |
| Audio | OGG + MP3 ambient loop in `public/audio/` |
| Infra | AWS CDK (S3 + CloudFront + ACM + Route 53) in `../infra` |

Requires **Node 24+**.

---

## 3. Architecture & separation of concerns

Strict layering. A layer may only depend on the layers above it in this list:

```
constants/   → named constants & enums (zero magic values). Depends on nothing.
config/      → JSON data (bodies, spacecraft, funfacts, ui). EN + ES.
state/       → in-memory / localStorage state. No DOM, no Phaser.
logic/       → pure functions (scale, orbit, i18n, library, funfacts, scenes,
               catalog). No DOM, no Phaser, no state mutation side-effects.
game/        → Phaser scenes, game objects and renderers. May use logic/state.
ui/          → DOM overlays (HUD, InfoModal, LibraryPanel). May use logic/state.
pages/       → Astro page shell + client bootstrap that wires it all together.
```

### Directory map (`frontend/src/`)

```
config/
  bodies.json        # Sun, planets, dwarf planets, moons, asteroids, comets (EN+ES)
  spacecraft.json    # All artificial spacecraft (EN+ES)
  missions.json      # Mission-mode itineraries (phases + copy), by spacecraft (EN+ES)
  funfacts.json      # Contextual notes for Linear mode (EN+ES)
  ui.json            # All user-facing UI strings (EN+ES)
constants/
  constants.ts       # ALL constants & enums — the only home for magic values
state/
  UserPreferences.ts # Switches + selected mission/restart mode; localStorage; pub/sub
  NavigationState.ts # Current solar distance; in-memory only; singleton + pub/sub
  ScaleState.ts      # Current unit + zoom; derived from UserPreferences
  ModeState.ts       # Current mode; derived from UserPreferences; pub/sub
  MissionState.ts    # Active mission runtime (status, elapsed); selection via prefs
logic/
  scale.ts           # Mkm<->AU, log scale, zoom/body clamps
  orbit.ts           # Orbital angle, period conversion, isOrbiting
  phases.ts          # Heliocentric transfer-arc geometry (phasePoint) — shared
  mission.ts         # Non-cyclic mission timeline (progress, completed phases, years)
  i18n.ts            # getText(key, lang); builds dictionaries from ui/bodies/spacecraft
  library.ts         # Config type definitions + buildLibraryTree
  funfacts.ts        # getFunFactsAtDistance
  catalog.ts         # Typed loaders + lookups over bodies/spacecraft JSON
  missions.ts        # Typed loader + lookup over missions JSON
  scenes.ts          # Pure mode<->scene-key routing (sceneKeyForMode/otherSceneKeys)
game/
  scenes/OrbitalMapScene.ts (abstract base), LinearScene.ts, EllipseScene.ts, MissionScene.ts
  objects/CelestialBody.ts, Spacecraft.ts, OrbitLine.ts, SunArrow.ts
  renderers/BodyRenderer.ts, RulerRenderer.ts
ui/
  HUD.ts, InfoView.ts, LibraryModal.ts, MissionModal.ts, MissionPanel.ts
pages/
  index.astro        # Page shell, theme CSS, client bootstrap
tests/
  *.test.ts          # Vitest unit tests (logic + state only; never import Phaser)
```

### Hard rules

- **No UI component or Phaser scene reads `localStorage` directly.** Always go
  through the `state/` layer.
- **No user-visible text is hardcoded.** All strings come from `config/*.json`
  and are resolved through `getText` (`logic/i18n.ts`).
- **No magic values.** Every domain number/string lives as a named `const` or
  `enum` in `constants/constants.ts`.
- **Pure logic stays pure.** Files in `logic/` must not import Phaser or touch
  the DOM. This is what makes them unit-testable.
- **One responsibility per file.** Reuse helpers instead of duplicating.

---

## 4. State layer — where it lives and how to extend it

| State | Storage | Notes |
|---|---|---|
| `UserPreferences` | `localStorage` | language, mode, unit, audio, selected mission, restart mode. Read on init, written on every change. Exposes `subscribe()`. |
| `NavigationState` | memory only | current solar distance (million km). Survives a mode switch, lost on reload. |
| `ScaleState` | memory | unit + zoom (pixels-per-million-km), derived from prefs. |
| `ModeState` | memory | current mode, derived from prefs; persists through `UserPreferences`. |
| `MissionState` | memory + prefs | active mission run status + elapsed sim time (memory); selected mission id + restart mode delegated to `UserPreferences` (persisted). |

Each state object is exported both as a **class** (for unit tests:
`new UserPreferences()`) and as a **singleton** (for the app: `userPreferences`).
localStorage keys are constants (`LS_KEY_*`). To add a new persisted
preference: add an `LS_KEY_*` and a default constant, then getter/setter that
read/write through the same `safeStorage()` pattern, and `notify()` subscribers.

---

## 5. Coding conventions

- TypeScript strict; no unused locals/params (prefix intentionally-unused params
  with `_`).
- Constants only — see §3. If you need a number/string with meaning, name it in
  `constants.ts`.
- Keep `logic/` and `state/` free of Phaser/DOM.
- Phaser/DOM glue is the "visual" layer; it is verified by running the app, not
  by unit tests (see §6 and §8).
- Comments explain *why*, not *what*. English only.

---

## 6. TDD working mode (mandatory)

This project is developed **test-first**:

1. **Every change must be covered by a test.** Before writing implementation
   code, add or extend a unit test that expresses the desired behavior.
2. **The test must fail first.** Run `npm test` and confirm the new test is red
   (failing assertion or unresolved import) for the *right* reason — not a
   syntax/type error.
3. **Then write the minimum code to make it pass.** Do not add code that does
   not make at least one test pass.
4. **Re-run the full suite.** All tests must be green before the change is done.
5. **Never modify, add, or remove tests without explicit developer
   authorization.** Existing tests are a contract. If a change seems to require
   editing a test, stop and ask the developer first.

### What is and isn't unit-tested

- **Unit-tested (must follow TDD):** everything in `logic/` and `state/`, and
  any pure helper. Tests never import Phaser.
- **Not unit-tested (verify by running the app):** Phaser scenes/objects/
  renderers and DOM rendering. When a fix lives here, extract the *decision*
  into a pure, testable helper (e.g. `logic/scenes.ts`) and unit-test that; the
  rendering itself is verified manually in the browser (`npm run dev`).

---

## 7. How-to guides

### Add a new celestial body

1. Add an entry to `config/bodies.json` with **all** fields:
   `id`, `type` (`star|planet|dwarf_planet|moon|asteroid|comet`), `host`
   (`null` for solar-orbiting; planet id for moons), `orbitalRadius_mkm`,
   `orbitalPeriod_years`, `rotationPeriod_days`, `radius_km`, `eccentricity`,
   `temperatureMin_c`, `temperatureMax_c`, `missionStatus`, `missionEndYear`,
   and `en`/`es` objects `{ name, description, facts[] }`.
2. Names/descriptions resolve automatically via i18n (`<id>.name`,
   `<id>.description`). No code change needed for text.
3. (Optional, moons only) Add `speedFactor` (number, higher = faster) to tune a
   moon's Ellipse-mode orbit speed; omit it to use the ring-proximity default
   (inner rings spin faster). Cosmetic only — see `logic/orbiterSpeed.ts`. The
   same field works on host-orbiting entries in `spacecraft.json`.
4. (Optional) Add a color in `BODY_COLORS` in `game/renderers/BodyRenderer.ts`
   for a custom look; otherwise a per-type default is used.
5. **Counts are asserted by tests.** `library.test.ts` expects exactly **8
   planets** and **5 dwarf planets**. Adding/removing a `planet` or
   `dwarf_planet` **will break a test** → this is a spec-level change: consult
   the developer (see §9) before changing the test.

### Add a new spacecraft

1. Add an entry to `config/spacecraft.json`: `id`, `type`
   (`space_telescope|probe|rover|orbiter`), `host`, `launchYear`,
   `missionStatus` (`active|complete|en_route`), `missionEndYear`,
   `orbitalRadius_mkm`, and `en`/`es` `{ name, objectives, instruments[], facts[] }`.
2. If the craft does **not** orbit the Sun (interstellar probe), add its `id` to
   `NON_ORBITING_PROBE_IDS` in `constants.ts` so it renders at a static
   position and `isOrbiting()` returns `false`.
3. A craft that hops between bodies (e.g. OSIRIS-REx, Voyager 1) is not given a
   `phases` field here — it gets a full **mission** in `missions.json` instead
   (see "Add a new mission" below). In Ellipse mode every craft either orbits its
   `host`, traces a solar orbit, or sits static (interstellar probes).
4. `library.test.ts` checks total counts dynamically and that `cassini` has
   `missionStatus === "complete"`; keep those consistent.

### Add a new mission (Mission mode)

1. Add an entry to `config/missions.json`: `id`, `spacecraftId` (an id in
   `spacecraft.json`, reused for name/image/objectives), `durationYears` (must
   equal the sum of the phase durations), a `phases[]` array, and `en`/`es`
   `{ name, summary, highlights[] }`.
2. Each phase is `{ from, to, durationYears, en:{label}, es:{label} }`. `from`/`to`
   are solar-orbiting body ids (`from === to` is a station-keeping/survey leg).
   The **final** `to` may be `"self"` (the constant `MISSION_SELF_ANCHOR`) — the
   craft's current known position, used by escape probes. `self` may only appear
   as the last phase's `to`.
3. The timeline is **non-cyclic** (clear start/end): see `logic/mission.ts`
   (`missionProgressAt`, `completedPhaseCount`, `formatElapsedYears`), tested in
   `mission.test.ts`. Rendering lives in `game/scenes/MissionScene.ts` (extends
   `OrbitalMapScene`); the years counter + phase checklist are in
   `ui/MissionPanel.ts` and the picker in `ui/MissionModal.ts`.
4. `missions.test.ts` asserts the roster and config integrity (anchors are real
   solar bodies or `self`, durations match, endpoints). Update it (with
   authorization) when changing the mission set.

### Add a new fun fact

1. Add an entry to `config/funfacts.json`: `id` (unique string),
   `triggerDistanceMkm`, and `en`/`es` `{ text }`.
2. `funfacts.test.ts` assumes the **Asteroid Belt** fact triggers at ~414 Mkm
   and that it is the only fact reached at that distance. Keep the asteroid-belt
   trigger ≤ 414 Mkm and other triggers above it, or update the test (with
   authorization).

### Add a new UI string

1. Add the key under both `en` and `es` in `config/ui.json` (nested objects;
   the key is the dotted path, e.g. `hud.newButton`).
2. Read it in code via `getText('hud.newButton', lang)`. Never hardcode the
   literal.

---

## 8. Test suite

Located in `src/tests/`. Run with `npm test` (Vitest, jsdom). No test imports
Phaser.

| File | Covers |
|---|---|
| `scale.test.ts` | unit conversion, log scale bounds & monotonicity, zoom/body clamps |
| `orbit.test.ts` | orbital angle progression, speed scaling, period ratio, non-orbiting probes |
| `phases.test.ts` | heliocentric transfer-arc geometry (`phasePoint`): start/end, blended radius, stays clear of the Sun, prograde sweep, coincident endpoints |
| `mission.test.ts` | non-cyclic mission timeline: total duration, active phase + fraction, clamp at end (`done`, no loop), completed-phase count, elapsed-years readout/format |
| `missions.test.ts` | `missions.json` integrity: roster, real spacecraft refs, anchors are solar bodies or `self`, `self` only final, durations match, endpoints (OSIRIS→Earth, Bepi→Mercury, escape→self) |
| `missionstate.test.ts` | UserPreferences mission persistence (id + restart mode), MissionState run status/elapsed/start/restart/complete |
| `state.test.ts` | UserPreferences defaults/persistence, NavigationState in-memory & handoff |
| `i18n.test.ts` | getText EN/ES, fallback, `I18nKeyNotFoundError` |
| `library.test.ts` | grouping by type (8 planets, 5 dwarfs), grouping by host (Sun/planet/interstellar), name filter, complete missions, total count |
| `funfacts.test.ts` | belt trigger, null before first trigger, language, no repeats |
| `modestate.test.ts` | ModeState derivation, setMode persist/sync, subscribe/notify |
| `scenes.test.ts` | pure `sceneKeyForMode` (3 modes) / `otherSceneKeys` routing |

### Fixtures the tests assume (keep consistent or consult the dev)

- `sun.name` resolves to `"Sun"` (EN) / `"Sol"` (ES).
- Exactly 8 `planet` and 5 `dwarf_planet` entries in `bodies.json`.
- `cassini` spacecraft has `missionStatus: "complete"`.
- Asteroid-belt fun fact triggers at ≤ 414 Mkm and is the only one reached there.
- `1 AU = 149.598 million km` (`MKM_PER_AU`).

---

## 9. Consistency with the Gherkin specification (consult rules)

The features below (mirrored from `spec.md`) define the intended behavior.

**Before implementing any change, check it against these scenarios.** If a
requested change:

- **contradicts** an existing scenario, or
- would require **modifying, adding, or removing** a feature/scenario, or
- is **not covered** by any scenario (ambiguous behavior),

then **stop and consult the developer first.** Do not silently diverge from the
Gherkin spec. When the developer approves a behavioral change, update the
relevant scenario here and in `spec.md`, and (following §6) add/adjust the
covering test **with authorization** before coding.

### Feature: Language switch
```gherkin
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
A single two-column modal merges the element library and the per-element info.
```gherkin
Scenario: Open from the Library button
  Given the app is loaded
  When the user clicks the Library button
  Then the modal opens with the element list grouped by type
  And the information column shows a placeholder

Scenario: Open by selecting an element
  Given the user is in Linear or Ellipse mode
  When the user clicks on a celestial body
  Then the modal opens showing that body's name, image, and data fields
  And fields not applicable to the body type are not shown

Scenario: Search elements by name
  Given the modal is open
  When the user types into the search box
  Then only elements whose name matches are listed, ignoring case and accents
  And groups with no matching element are hidden

Scenario: Group by orbited body
  Given the modal is open
  When the user selects the "Orbits" grouping
  Then solar-orbiting bodies are grouped under the Sun
  And each moon and host-orbiting spacecraft is grouped under the body it orbits
  And interstellar probes are grouped on their own

Scenario: Navigate to an element
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
Scenario: Choosing a mission is mandatory
  Given the user switches to Mission mode
  Then the mission picker modal opens immediately
  And the scene waits until a mission is started

Scenario: Start a mission
  Given the mission picker is open
  When the user selects a mission and clicks Start
  Then the scene resets and the craft begins its itinerary from the start
  And the elapsed-years counter runs and the phase checklist fills in as phases complete

Scenario: Round-trip itinerary (OSIRIS-REx)
  Given OSIRIS-REx is running
  Then it cruises to Bennu on a heliocentric arc, orbits it during the survey phase, and returns to Earth
  And anchor bodies keep orbiting the Sun throughout

Scenario: One-way itinerary (BepiColombo)
  Given BepiColombo is running
  Then it cruises inward and ends in orbit around Mercury, never returning to Earth

Scenario: Escape itinerary ends at the current position
  Given an escape probe (Voyager, Pioneer, New Horizons) is running
  Then it flies past its planets and coasts out to its current known position (the self anchor)
  And the journey spans decades on the elapsed-years counter

Scenario: Mission completion freezes the scene
  Given a mission reaches its final anchor with restart mode Manual
  Then the whole scene freezes in place

Scenario: Automatic restart
  Given a mission reaches its final anchor with restart mode Auto
  Then every element snaps back to its base position and the itinerary replays

Scenario: Pause and speed
  Given a mission is running
  When the user presses pause or selects 1x/2x/5x
  Then the mission and the bodies pause or advance accordingly

Scenario: Mission lines toggle
  Given the mission trajectory is visible
  When the user toggles Mission lines off
  Then the trajectory overlay hides, independently of the orbit-lines toggle

Scenario: Opening the picker mid-mission
  Given a mission is in progress
  When the user opens the mission modal
  Then the mission keeps running until the user starts a different one
```

### Feature: Scale system
```gherkin
Scenario: Linear orbital radii in Ellipse mode
  Given the Ellipse scene is loaded
  Then Neptune's screen radius is greater than Earth's screen radius
  And the ratio between them reflects the true linear distance proportion

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

## 10. Running the project

```bash
npm install        # install dependencies
npm run dev        # start the Astro dev server (Phaser app)
npm test           # run the unit suite (Vitest) — must be green
npm run build      # produce the static site in dist/
npm run check      # astro type-check
```

Deployment is handled by the GitHub Actions workflow
(`.github/workflows/deploy.yml`) and the CDK stack in `../infra` — see the
project `README.md` and `infra/README.md`.

---

## 11. Gotchas learned the hard way

- **Phaser input vs DOM overlays:** the game is created with
  `input: { windowEvents: false }`. Without it, Phaser binds pointer listeners
  to `window`, so clicks on the HUD/modal/library bubble up and trigger a
  hit-test on the body underneath, opening the wrong modal.
- **Never touch `this.cameras.main` in a scene's `shutdown`:** the camera is
  already torn down. Persist position to `NavigationState` every frame in
  `update()` instead. Touching the camera in `shutdown` throws inside Phaser's
  shutdown and breaks the stop→start scene transition.
- **Scene switching:** the active scene's `onShutdown` must not throw, or the
  subsequent `start(target)` is skipped and the canvas goes blank. The pure
  routing decision lives in `logic/scenes.ts` (tested); the Phaser `stop/start`
  is verified in the browser.
