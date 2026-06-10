# CLAUDE.md — Working guide for Solar Explorer (frontend)

This file tells an AI assistant (and any developer) how to work on this
codebase. Read it fully before making changes. Everything here is normative.

> All source code, tests, comments and documentation are written in **English**.

---

## 1. Purpose

Solar Explorer is a **frontend-only**, educational web app to navigate a
scale model of the solar system. It has two interactive modes — **Linear** and
**Ellipse** — and covers the Sun, planets, dwarf planets, natural satellites,
artificial spacecraft, asteroids and comets, from the Sun out to Voyager 1.

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
  funfacts.json      # Contextual notes for Linear mode (EN+ES)
  ui.json            # All user-facing UI strings (EN+ES)
constants/
  constants.ts       # ALL constants & enums — the only home for magic values
state/
  UserPreferences.ts # Switches; persisted to localStorage; singleton + pub/sub
  NavigationState.ts # Current solar distance; in-memory only; singleton + pub/sub
  ScaleState.ts      # Current unit + zoom; derived from UserPreferences
  ModeState.ts       # Current mode; derived from UserPreferences; pub/sub
logic/
  scale.ts           # Mkm<->AU, log scale, zoom/body clamps
  orbit.ts           # Orbital angle, period conversion, isOrbiting
  i18n.ts            # getText(key, lang); builds dictionaries from ui/bodies/spacecraft
  library.ts         # Config type definitions + buildLibraryTree
  funfacts.ts        # getFunFactsAtDistance
  catalog.ts         # Typed loaders + lookups over bodies/spacecraft JSON
  scenes.ts          # Pure mode<->scene-key routing (sceneKeyForMode/otherSceneKey)
game/
  scenes/LinearScene.ts, EllipseScene.ts
  objects/CelestialBody.ts, Spacecraft.ts, OrbitLine.ts, SunArrow.ts
  renderers/BodyRenderer.ts, RulerRenderer.ts
ui/
  HUD.ts, InfoModal.ts, LibraryPanel.ts
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
| `UserPreferences` | `localStorage` | language, mode, unit, audio. Read on init, written on every change. Exposes `subscribe()`. |
| `NavigationState` | memory only | current solar distance (million km). Survives a mode switch, lost on reload. |
| `ScaleState` | memory | unit + zoom (pixels-per-million-km), derived from prefs. |
| `ModeState` | memory | current mode, derived from prefs; persists through `UserPreferences`. |

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
3. (Optional) Add a color in `BODY_COLORS` in `game/renderers/BodyRenderer.ts`
   for a custom look; otherwise a per-type default is used.
4. **Counts are asserted by tests.** `library.test.ts` expects exactly **8
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
3. `library.test.ts` checks total counts dynamically and that `cassini` has
   `missionStatus === "complete"`; keep those consistent.

### Add a new fun fact

1. Add a `FunFactId` enum member in `constants.ts`.
2. Add an entry to `config/funfacts.json`: `id` (matching the enum value),
   `triggerDistanceMkm`, and `en`/`es` `{ text }`.
3. `funfacts.test.ts` assumes the **Asteroid Belt** fact triggers at ~414 Mkm
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
| `state.test.ts` | UserPreferences defaults/persistence, NavigationState in-memory & handoff |
| `i18n.test.ts` | getText EN/ES, fallback, `I18nKeyNotFoundError` |
| `library.test.ts` | grouping (8 planets, 5 dwarfs), complete missions, total count |
| `funfacts.test.ts` | belt trigger, null before first trigger, language, no repeats |
| `modestate.test.ts` | ModeState derivation, setMode persist/sync, subscribe/notify |
| `scenes.test.ts` | pure `sceneKeyForMode` / `otherSceneKey` routing |

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
  And the ruler in Linear mode updates
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

### Feature: Info Modal
```gherkin
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
