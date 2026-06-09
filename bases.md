# Solar Explorer — Project Brief

## Goal

An educational game where the user can visualize and navigate a scale representation of the solar system.

Two modes are available:

1. **Linear** — Starts at the Sun. The user navigates by scrolling vertically (mouse scroll or touch gesture), visiting each planet and other celestial or satellite bodies (natural and artificial). Clicking any element opens its information. In this mode all elements are simulated as aligned on a straight vertical line.
2. **Ellipse** — The mode that most closely represents the actual shape of the solar system. All elements are shown orbiting. Clicking any element opens its information. Navigation supports both scroll and zoom.

---

## General Style

Space theme. Menus, buttons, modals, and all other visual elements should make the user feel they are inside a spacecraft application.

For celestial bodies and probes, advise whether they can be generated procedurally or whether external images need to be sourced.

A space-themed audio track can be included — advise where to source it.

---

## Non-Functional Specifications

- Frontend-only code.
- Two projects inside the repository:
  - **Infra** — CloudFront, S3, Route 53 registration, configurable URLs.
  - **Frontend project** — GitHub Action for publishing and running cache invalidation.
- Astro framework.
- JavaScript + TypeScript for functionality (no framework).
- Phaser.io for graphics.
- Code and documentation always in English.
- Development principles:
  - All source code, tests, and documentation (`spec.md`, `claude.md`, `readme.md`) in English.
  - All user-visible text comes from JSON configuration files organized by the section where it appears and by language.
  - Separate logic from visuals, and organize code so that each function does one thing, each section is clearly identified and organized, everything reusable is reused, and no magic values are left without a named constant or enum — making modifications easy and tests straightforward to run.
  - System state is separated from logic and visuals so the user's last position can be restored when switching modes.
  - Once unit tests are created they will not be modified, added to, or removed without developer authorization.
  - Once source code is created, sections unrelated to the current request will not be modified without developer authorization.
  - All sensitive data must go in a `.env` file.
  - All non-sensitive configuration (e.g. element information text in each language) must go in a `.json` file.

---

## Functional Specifications

- English / Spanish language switch.
- Ellipse / Linear mode switch.
- Distance unit switch: million kilometers (Million km) / astronomical units (AU).
- Spatial audio on/off switch.
- Current position state persisted between modes (in memory only).
- Switch selection state persisted (in localStorage).
- Clicking an element opens a modal with its information.
- A library button shows a tree with the name of each element, grouped by type, and clicking any entry opens its information.
- The starting / central point depending on mode is the Sun.
- The ending point is the current position of Voyager 1.

### Ellipse Mode

- Zoom.
- Navigation on X and Y axes.
- An arrow that always points toward the Sun.
- Elements orbiting.
- Orbit speed switch (1×, 2×, 5×).
- Orbit lines toggle (visible as a smooth circular/elliptical line, or hidden).
- Accounts for orbit overlaps such as Pluto and Neptune, and for probes like the Voyagers that are not orbiting the solar system but rather moving away from it, shown static at their current position.

### Linear Mode

- Navigation on Y axis only.
- Buttons to jump quickly to the next or previous element.
- A ruler on the left side shows the distance traveled from the Sun.
- As the user navigates, short contextual notes appear between elements — for example, near the Asteroid Belt: "Did you know the average distance between asteroids in the belt is X, which is why encountering one is actually unlikely?" Or at the end: "This is as far as we go — the Oort Cloud is X AU away and Proxima Centauri is Y AU away."

---

## Scales

- Million km and AU unit switch.
- Distance — Maximum zoom: 1000 px per 50 million km. Minimum zoom: 1000 px per 2000 million km.
- Element diameter — Proportional among planets, minor planets, and natural satellites. Illustrative for artificial satellites and asteroids since true scale would make them invisible. In Ellipse mode where zoom is available, a minimum and maximum size is enforced so that even though proportions are maintained, every element remains appreciable and does not collapse to a single pixel.
- Elements orbit (in Ellipse mode). Base rate: one Earth year equals one minute in the app; all other periods are derived from that ratio.

---

## Elements to Include

Scope covers celestial bodies and probes of the solar system and its borders.

- Planets.
- Minor planets (Pluto and the most well-known bodies in the asteroid belts).
- Natural satellites (our Moon and the most well-known moons of other planets).
- Artificial satellites (Hubble, James Webb, Parker Solar Probe, Solar Orbiter, Mars Express, Juno, Voyager 1 and 2, Pioneer 10 and 11 — additional suggestions welcome).
- Asteroids / comets — suggestions welcome.

---

## Element Information

- Name.
- Photo of the element.
- Distance to the Sun.
- Time in years to complete one orbit around the Sun (or around its host body if it is a satellite).
- Time in days for one self-rotation.
- Temperature.
- Other data of interest.

Not every field applies to every element — for example, artificial satellites should instead list their objectives and the function of their main instruments.

This information is managed as configurable JSON data in both English and Spanish.

---

## Points to Discuss

In addition to anything that needs clarification and any suggestions, the following needs to be confirmed (recommendations and reasoning welcome):

- Technologies to use.
- Phaser.io vs plain JavaScript.
- Scale and proportion handling.
- General graphic style and element style.
- Recommended elements to add.

---

## Spec Definition

The output of this discussion is a `spec.md` file that will be used with Claude Code. It will contain:

- Prompts needed to convey this working style and stages to Claude Code.
- No source code inside the spec.
- All agreed specifications and details.
- Gherkin Syntax format representing each feature of the system.
- List of unit tests satisfying each feature, with a breakdown of their objective and expected input/output (no code).
- Implementation stages (executed in order, one at a time, with developer authorization before proceeding — Claude Code starts with Stage 1 and continues only when the developer requests it, confirming when the spec has been fully implemented):
  1. Creation of the infrastructure publishing stack with AWS CDK.
  2. Dependency installation in the frontend project (no code yet).
  3. Generation of unit tests that will fail at this stage.
  4. Generation of code that makes the unit tests pass (no code will be added that does not pass the tests).
  5. Generation of `claude.md` and `readme.md` with their respective focuses.