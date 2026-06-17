# Solar Explorer — Frontend

An educational, **frontend-only** web app to explore a scale model of the solar
system. Travel from the Sun out to Voyager 1 in three interactive modes
(Linear, Ellipse and Mission) and click any element to learn about it.
Available in **English** and **Spanish**.

Built with **Astro** (static) + **Phaser 4** (canvas) + **TypeScript** (strict),
tested with **Vitest**.

## What it does

- **Three modes**
  - **Linear** — scroll vertically (wheel, drag, or the Up/Down arrow keys) from
    the Sun outward; a left-edge distance
    counter shows how far you've traveled (recoloring by zone) and contextual
    fun facts appear at key boundaries
    (asteroid belt, Kuiper belt, heliopause, journey's end). Jump between
    elements with Previous/Next.
  - **Ellipse** — an orbital map with the Sun at the origin; pan and zoom (drag/
    pinch/wheel, the arrow keys to pan, or `+`/`-` to zoom),
    bodies orbit in real time (1 Earth year = 60 s at 1×, switchable 1×/2×/5×),
    toggle orbit lines, and a compass arrow always points to the Sun.
  - **Mission** — replays a single spacecraft's itinerary (e.g. Voyager 1 or
    OSIRIS-REx) from launch to its final destination on the shared orbital map,
    with an elapsed-years counter and a phase checklist. Shares the same
    pan/zoom controls as Ellipse mode.
- **Info modal** for every body/spacecraft: procedurally drawn image, distance,
  orbital and rotation periods, temperature, facts; for spacecraft, mission
  objectives, instruments and a "Mission complete" badge where applicable.
- **Library** panel listing everything grouped by category.
- **Switches** (all persisted to `localStorage`): language, mode, distance unit
  (Million km / AU), and ambient audio on/off.

All celestial bodies and spacecraft are **drawn procedurally** on a canvas — no
external image assets.

## Run locally

Requires **Node 24+**.

```bash
npm install
npm run dev      # http://localhost:4321
```

Other scripts:

```bash
npm test         # run the unit test suite (Vitest)
npm run build    # build the static site into dist/
npm run preview  # preview the built site
npm run check    # astro type-check
```

## Configuration (`.env`)

Copy the example and fill in your values (never commit `.env`):

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PUBLIC_DOMAIN` | Full domain the app is served from |
| `PUBLIC_CF_DISTRIBUTION_ID` | CloudFront distribution ID (cache invalidation) |
| `PUBLIC_AWS_REGION` | AWS region |

Only variables prefixed with `PUBLIC_` are exposed to client code by Astro.

## Deploy

Deployment is automated by GitHub Actions
(`.github/workflows/deploy.yml`): it installs dependencies, runs the unit tests
(failing the build on any failure), builds the site, syncs `dist/` to S3 and
invalidates the CloudFront cache.

The hosting infrastructure (private S3 bucket, CloudFront, ACM certificate,
Route 53 record) is provisioned with AWS CDK. See **[`../infra/README.md`](../infra/README.md)**
for how to deploy it and which repository secrets the workflow needs.

## Add or modify content

All content lives in `src/config/*.json` (bilingual EN/ES):

- `bodies.json` — celestial bodies
- `spacecraft.json` — artificial spacecraft
- `funfacts.json` — Linear-mode contextual notes
- `ui.json` — all UI strings

Step-by-step instructions for adding a body, spacecraft, fun fact or UI string,
plus the project's architecture and conventions, are in
**[`CLAUDE.md`](CLAUDE.md)**.

> This project follows **test-driven development**: every change ships with a
> test that failed before the implementation existed, and existing tests are
> never modified without the developer's authorization. See `CLAUDE.md` §6.

## Audio attribution

The HUD audio toggle plays a single looping ambient track from
`public/audio/` (`ambient.ogg` with an `ambient.mp3` fallback). The track must
be sourced from the **NASA Audio Collection** (public domain) or
**Freesound.org** (CC0) and is **not committed** to the repository. Until it is
added, the toggle works but stays silent. Record the source URL and license in
`public/audio/README.md`.
