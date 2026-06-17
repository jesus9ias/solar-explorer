# Solar Explorer

An educational, **frontend-only** web app to navigate and explore a scale model
of the solar system. Travel from the Sun out to Voyager 1 in three interactive
modes — **Linear**, **Ellipse** and **Mission** — and click any element (planet,
moon, dwarf planet, asteroid, comet, spacecraft or probe) to learn about it.
Available in **English** and **Spanish**.

All celestial bodies and spacecraft are **drawn procedurally** on a canvas — no
external image assets for the bodies themselves.

## Modes

- **Linear** — scroll vertically from the Sun outward on a single axis; a
  left-edge distance counter tracks how far you've traveled (recoloring by zone)
  and contextual fun facts appear at key boundaries.
- **Ellipse** — an orbital map with the Sun at the origin; pan and zoom while
  bodies orbit in real time (1 Earth year = 60 s at 1×, switchable 1×/2×/5×).
- **Mission** — replays a single spacecraft's itinerary (e.g. Voyager 1 or
  OSIRIS-REx) from launch to its final destination on the shared orbital map.

## Repository layout

This is a monorepo with two independent packages:

```
solar-explorer/
├── frontend/   # Astro + Phaser 4 + TypeScript web app (the product)
└── infra/      # AWS CDK stack: S3 + CloudFront + ACM + Route 53 (hosting)
```

| Path | What it is | Docs |
|---|---|---|
| `frontend/` | The Astro/Phaser application | [frontend/README.md](frontend/README.md) · [frontend/CLAUDE.md](frontend/CLAUDE.md) |
| `infra/` | AWS CDK hosting stack | [infra/README.md](infra/README.md) |
| `spec.md` | Authoritative product specification (requirements + Gherkin) | [spec.md](spec.md) |
| `bases.md` | Original project brief | [bases.md](bases.md) |

## Quick start

Requires **Node 24+**.

```bash
cd frontend
npm install
npm run dev      # http://localhost:4321
```

Other useful scripts (run from `frontend/`):

```bash
npm test         # run the unit test suite (Vitest)
npm run build    # build the static site into dist/
npm run check    # astro type-check
```

## Technology stack

| Concern | Technology |
|---|---|
| Framework | Astro (static output) |
| Game engine / canvas | Phaser 4 |
| Language | TypeScript (strict) |
| Tests | Vitest (jsdom) |
| Infrastructure | AWS CDK (TypeScript) |
| Hosting | S3 + CloudFront + ACM + Route 53 |
| CI/CD | GitHub Actions |

## Deployment

The frontend is a static site hosted on a private S3 bucket served through
CloudFront. The hosting infrastructure is provisioned with AWS CDK — see
[infra/README.md](infra/README.md) for how to deploy it and which outputs the
frontend workflow consumes.

Deploys are automated by GitHub Actions
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)): on every push to
`main` that touches `frontend/**`, it installs dependencies, runs the unit tests
(failing the build on any failure), builds the Astro site, syncs `dist/` to S3
and invalidates the CloudFront cache.

## Documentation

- **[spec.md](spec.md)** — the authoritative product specification: requirements,
  architecture, data shapes and the full Gherkin feature set.
- **[frontend/README.md](frontend/README.md)** — running the app, configuring
  `.env`, adding content, audio attribution.
- **[frontend/CLAUDE.md](frontend/CLAUDE.md)** — implementation guide for AI
  assistants and developers: architecture, conventions, TDD workflow and
  step-by-step how-to guides.
- **[infra/README.md](infra/README.md)** — deploying the AWS hosting stack.

## Conventions

This project follows **test-driven development** and a strict separation of
concerns (constants → config → state → logic → game → ui). All user-visible text
comes from bilingual JSON config; there are no hardcoded strings or magic values.
See [frontend/CLAUDE.md](frontend/CLAUDE.md) for the full rules before making
changes.
