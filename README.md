# nickf.info

Portfolio of Nick Fuenmayor, Product Designer & Software Developer.
A single-page static site built with Astro, with React Three Fiber scenes,
GSAP scroll animations and a "Reshape" theme switch that randomizes the hue,
the typography and the 3D shapes.

## Stack

- **Astro 5** (`output: "static"`), React islands, `@astrojs/sitemap`
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **3D:** `three`, `@react-three/fiber`, `@react-three/drei`,
  `@react-three/rapier` (physics), `@react-three/postprocessing` (N8AO)
- **Animation:** GSAP + ScrollTrigger, CSS keyframes
- **Content:** Astro content collections (`src/content.config.ts`)

## Project structure

```text
/
├── docs/
│   └── PERFORMANCE.md          # performance pass: what changed, why, how to measure
├── public/
│   ├── 3d/                     # GLB model for the About logo scene
│   ├── docs/                   # CV and project PDFs
│   └── fonts/                  # subset WOFF2 fonts (+ TTF fallbacks)
├── src/
│   ├── assets/trail-images/    # images for the testimonials cursor trail
│   ├── components/
│   │   ├── general/            # Card, Button, Section, Cursor…
│   │   ├── react/              # 3D scenes (Scene.tsx, LogoScene.tsx), quality tiers, hooks
│   │   └── sections/           # Hero, Projects, Testimonials, About
│   ├── data/
│   │   ├── projects/<slug>/    # one Markdown file + cover images per project
│   │   └── testimonials/       # index.json + avatars
│   ├── events/changeTheme.ts   # "themeChanged" event used by Reshape
│   ├── layouts/Layout.astro    # <head>, font preloads, theme context, cursor
│   ├── pages/index.astro       # the page: Hero → Navbar → Projects → Testimonials → About
│   └── styles/                 # global, theming (per-theme CSS variables), fonts, sizing
└── package.json
```

### Adding a project

Create `src/data/projects/<slug>/<slug>.md` with the frontmatter defined by
`ProjectsSchema` in `src/models/projects/index.ts` (`order`, `title`,
`description`, `role`, `cto`, `date`, `fields`, `technologies`, `cover`, …).
Put the cover image next to it. Projects are sorted by `order`.

### Theming

The theme lives on `<body data-theme-context="nick">` via `data-theme` (0 or 1)
and `data-theme-hue`. `src/styles/theming.css` derives every color from the
hue. Reshape (`src/utils.ts` → `changeTheme`) picks a random hue, toggles the
theme and dispatches `themeChanged`, which the 3D scene and the hero title
listen to.

## Commands

| Command        | Action                                        |
| :------------- | :-------------------------------------------- |
| `pnpm install` | Install dependencies                          |
| `pnpm dev`     | Start the dev server at `localhost:4321`      |
| `pnpm build`   | Build the static site to `./dist/`            |
| `pnpm preview` | Preview the production build locally          |

## Performance

The hero 3D scene picks a quality tier once at load (`src/components/react/quality.ts`)
and only toggles ambient occlusion at runtime. Both canvases pause when
off-screen. To preview the tiers:

- `http://localhost:4321/?quality=low`: what weak laptops and phones get
- `http://localhost:4321/?quality=high`: full effects

Measure performance on the production build (`pnpm build && pnpm preview`),
not the dev server. See [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) for the
full explanation, measuring tools and best-practice checklist.
