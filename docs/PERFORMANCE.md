# Performance pass: what changed and why

_2026-11-06_

The portfolio ran at 145 fps on a fast desktop but stuttered on weaker machines.
The cause wasn't the amount of content but a few expensive habits:

- 3D scenes kept rendering while nobody could see them.
- A quality switch rebuilt the 3D scene over and over.
- Some effects made the GPU recompute their pixels every frame.
- The fonts weighed 1 MB.

The art direction was kept: same intro, Reshape, shadows, lighting, glass,
trail and cursor.

| Measure                                  | Before                        | After                          |
| ---------------------------------------- | ----------------------------- | ------------------------------ |
| Worst frame on first Reshape             | 65 to 114 ms (visible freeze) | no long frame                  |
| Font download                            | 1.06 MB (TTF)                 | 39 KB (WOFF2, preloaded)       |
| `<img>` elements on the page             | 148                           | 36                             |
| 3D scenes while scrolled away            | render every frame            | paused                         |
| Cubes/shadows lost when spamming Reshape | yes (half the cubes + AO)     | never (AO pauses, comes back)  |
| Steady fps, fast desktop, every tier     | 145                           | 144 to 145                     |

Contents:

1. [How a browser draws a frame](#1-how-a-browser-draws-a-frame)
2. [How WebGL / three.js / React Three Fiber render](#2-how-webgl--threejs--react-three-fiber-render)
3. [Every change, explained](#3-every-change-explained)
4. [What was tried and reverted](#4-what-was-tried-and-reverted)
5. [How to measure and test](#5-how-to-measure-and-test)
6. [Best-practice checklist](#6-best-practice-checklist)

---

## 1. How a browser draws a frame

Smooth motion means producing a new frame every **16.7 ms on a 60 Hz screen**
(6.9 ms at 144 Hz). A frame that takes longer is dropped, and the eye reads
dropped frames as stutter. Every optimization here is about keeping each frame
inside that budget, especially on slow hardware.

### The three workers

- **Main thread**: runs your JavaScript (GSAP, React, three.js scene updates,
  physics). It also computes styles and layout and records paint commands.
  There is only one, so a 100 ms task blocks everything, including clicks.
- **Compositor thread**: takes already-painted layers and moves, scales and
  fades them. It keeps `transform` / `opacity` animations smooth even while
  the main thread is busy. That's why CSS keyframe marquees are cheap.
- **GPU**: turns layers into pixels, blends them, applies filters and runs
  WebGL. Its cost grows with **the number of pixels touched per frame**.

### The pipeline

```
 JavaScript ──▶ Style ──▶ Layout ──▶ Paint ──▶ Composite ──▶ pixels on screen
 (main)         (main)    (main)     (main)    (compositor + GPU)
```

1. **JavaScript**: event handlers, `requestAnimationFrame` callbacks,
   animation libraries.
2. **Style**: match CSS selectors to elements and compute final values. Cost
   grows with the number of elements whose style is _invalidated_.
3. **Layout**: compute positions and sizes. Reading layout
   (`getBoundingClientRect`, `offsetTop`) right after writing styles forces it
   to run immediately ("forced synchronous layout").
4. **Paint**: record drawing commands per layer (text, backgrounds, borders).
5. **Composite**: the GPU blends the layers, applying `opacity`, `transform`,
   `filter`, `backdrop-filter` and `mix-blend-mode`.

A change pays for its own step and every step after it:

| You change                          | Steps that run              |
| ----------------------------------- | --------------------------- |
| `transform`, `opacity`              | composite only (cheapest)   |
| `color`, `background-color`         | paint, composite            |
| `width`, `top`, font size, content  | layout, paint, composite    |

### What is expensive on weak GPUs

- **`backdrop-filter: blur()`**: the GPU reads everything behind the element,
  blurs it, then draws the element on top. If anything behind it moves (a
  marquee, a canvas, scrolling content), this repeats **every frame**.
- **`mix-blend-mode`, `filter`**: extra layers plus per-pixel math over the
  whole area.
- **Many promoted layers**: `will-change: transform` gives an element its own
  layer. Each layer uses GPU memory and adds composite work.
- **Large WebGL canvases**: every pixel runs a shader every frame (section 2).

### What is expensive on weak CPUs

- **Broad style invalidation**: `body:has(a:hover)` means any hover change can
  make the browser re-check styles across the whole document.
- **Layout thrashing**: reading layout inside `mousemove`, which can fire as
  often as the screen refreshes.
- **Parsing and compiling**: large JS bundles, large fonts, and WebGL shaders.
  A shader is compiled the first time a material is drawn, which can take tens
  of ms.

---

## 2. How WebGL / three.js / React Three Fiber render

### The render loop

React Three Fiber (R3F) runs a `requestAnimationFrame` loop. Every tick:

1. Runs every `useFrame` callback (here: physics impulses, camera easing,
   color damping, the logo rotation).
2. Steps the physics world (Rapier, inside `<Physics>`).
3. Renders the scene: for each visible mesh, the GPU runs a **vertex shader**
   per vertex and a **fragment shader per pixel it covers**.

The `<Canvas frameloop>` prop controls this loop:

- `"always"` (default): renders every frame forever, visible or not.
- `"demand"`: renders only when something calls `invalidate()`.
- `"never"`: stops the loop entirely.

### Why pixel count dominates GPU cost

The fragment shader runs once per pixel per pass. The hero canvas covers the
whole viewport. On a 2560×1300 screen that is about 3.3 million pixels. With
`dpr = 1.5` (device pixel ratio, how many real pixels per CSS pixel) it becomes
**2.25× more**, about 7.5 million pixels per pass. Laptops with high-density
screens report `devicePixelRatio = 2`, which is why the canvas is capped with
`dpr={[1, 1.5]}`.

### Passes multiply that cost

| Feature                          | What it does per frame                                                      |
| -------------------------------- | --------------------------------------------------------------------------- |
| Shadows (`castShadow`)           | renders the scene again from the light into a shadow map                    |
| `MeshTransmissionMaterial`       | renders the scene again into a private framebuffer (FBO), then blurs it     |
| `EffectComposer` + `N8AO`        | renders the scene to a texture, then runs full-screen ambient occlusion     |
| `multisampling` on the composer  | stores N samples per pixel for anti-aliasing (memory and bandwidth × N)     |
| `<Environment>` with Lightformers| renders a cube map. With `frames=1` (the default) only once, so it's cheap  |

An **FBO** (framebuffer object) is an off-screen image the GPU renders into, so
another pass can read it. Glass refraction and post-processing both need one.

### Shader compilation and mounting cost

Mounting a new material type or a new post-processing effect compiles shaders
and allocates FBOs. That's a one-time stall of tens to hundreds of ms. It's
fine once, at load, before anything is visible. It's terrible if it happens
repeatedly or in the middle of an animation, which is exactly what the old
quality switch did (section 3.2).

---

## 3. Every change, explained

Each entry follows the same pattern: **problem → fix → why it works → the
practice behind it.**

### 3.1 Pause 3D scenes when they're off-screen

**Problem.** Both canvases used the default `frameloop="always"`. While you
read the About section, the hero kept rendering 16 bodies, glass, AO and
physics at full speed. The logo scene did the same while you were at the top.

**Fix.** A small hook, `src/components/react/hooks/useInView.ts`, wraps an
`IntersectionObserver`. Each scene flips its loop on and off:

```tsx
const [wrapperRef, inView] = useInView<HTMLDivElement>();

<div ref={wrapperRef} className="h-full w-full">
  <Canvas frameloop={inView ? "always" : "never"} /* … */>
```

**Why it works.** `IntersectionObserver` is asynchronous and computed by the
browser, so it costs nothing per frame (unlike checking scroll position
yourself). `"never"` stops `useFrame` and therefore the physics step too.
`rootMargin: "100px"` starts rendering slightly before the canvas scrolls in,
so you never see a frozen frame.

**Practice.** _Never animate what the user can't see._ The same idea applies
to the testimonial marquee (3.6).

### 3.2 Quality tiers that never flip-flop

**Problem.** The old logic:

```tsx
const [perfSucks, degrade] = useState(true);   // everyone starts LOW
<PerformanceMonitor
  onDecline={() => degrade(true)}
  onIncline={() => degrade(false)}             // …and can go back up
/>
{connectors.map((p, i) => (perfSucks ? i % 2 === 0 : true) && <PhysicsElement … />)}
```

1. Every device started in low quality and upgraded **mid-intro**. That
   compiled the AO and environment shaders right as the title animated in.
2. With no limit on flips, a borderline laptop oscillated between low and
   high forever. Each flip mounted or unmounted the `EffectComposer` and the
   `Environment`, and added or removed **half of the physics bodies**. Every
   flip was a stall of 50 to 300 ms, which is the stutter people felt.

**Fix.** A new file, `src/components/react/quality.ts`, guesses the tier
**once, up front**:

```ts
if (matchMedia("(pointer: coarse)").matches) return "low";   // phones/tablets
if ((navigator.hardwareConcurrency ?? 8) <= 4) return "low"; // ≤ 4 CPU cores
// GPU name via WEBGL_debug_renderer_info: Intel, Mali, Adreno, PowerVR,
// SwiftShader (software rendering) … → "low"
return "high";
```

The tier only picks cheaper **settings**, fixed for the whole visit. At
runtime the `PerformanceMonitor` may toggle just one thing, ambient occlusion,
and it does that through the composer's `enabled` flag:

```tsx
const [quality] = useState<Quality>(detectQuality); // never changes
const [aoOn, setAoOn] = useState(true);

{monitorReady && (
  <PerformanceMonitor
    flipflops={4}
    onDecline={() => setAoOn(false)}
    onIncline={() => setAoOn(true)}
    onFallback={() => setAoOn(false)}
  />
)}
<EffectComposer enabled={aoOn} /* always mounted */>
  <N8AO halfRes={lowTier} quality={lowTier ? "performance" : "medium"} … />
</EffectComposer>
```

`monitorReady` becomes true 3 s after the hero enters the viewport and false
when it leaves. Unmounting the monitor resets its samples.

What each tier renders:

| Feature                        | High                 | Low                                 |
| ------------------------------ | -------------------- | ----------------------------------- |
| All 14 cubes + 2 glass shapes  | yes                  | yes, always (never removed)         |
| Shadows + spot/ambient light   | yes                  | yes                                 |
| Environment reflections        | yes                  | yes                                 |
| Ambient occlusion (N8AO)       | full resolution      | half resolution, "performance"      |
| Glass blur                     | 6 samples, 256px     | 3 samples, 128px                    |
| Resolution (dpr)               | 1 to 1.5             | 1                                   |

`?quality=low` or `?quality=high` in the URL forces a tier, so you can preview
exactly what a weak laptop sees.

**Why the cubes and shadows used to vanish when spamming Reshape.** The dark
contact shading between the cubes is the **ambient occlusion pass (N8AO)**,
not the shadow map. The cubes use `meshBasicMaterial`, which ignores lights.

`PerformanceMonitor` works like this:

- It samples fps in 250 ms windows. On a 144 Hz screen any window under
  60 fps counts as slow.
- If 8 of 10 windows (2.5 s) are slow, it fires `onDecline`.

Each Reshape rebuilds all 16 bodies (new colliders and geometry) and
recalculates the whole page theme, so a burst of clicks produces a run of slow
frames. The monitor read that as "this device is slow". In the original code,
a decline **unmounted AO and removed half the cubes** (`i % 2`). It was a false
alarm caused by the user's own clicking.

Two other false alarms are now avoided:

- **Load and intro.** Shader compiles make the first seconds slow. The monitor
  is mounted only 3 s after the hero becomes visible.
- **Coming back to the hero.** While the canvas is paused (3.1), no frames
  happen. On resume, the gap is measured as one enormous frame. The monitor is
  unmounted while off-screen, so it starts fresh.

**Why it works.** Expensive mounting (shader compile, FBO allocation) happens
once at load, while the canvas is still invisible (it fades in at 1.5 s). The
only runtime switch, `enabled`, skips a pass without destroying it. So it can
turn off under real load and back on when fps recovers, at zero cost.
`flipflops={4}` + `onFallback` settles it if fps hovers at the boundary.

**Why `deviceMemory` is not used.** Brave (and other privacy browsers) fake it
and mask the GPU name to prevent fingerprinting. Brave reported 4 GB on a
high-end PC, which classified it as weak. Heuristics are guesses, so the
monitor stays as the safety net.

**Practice.**

- _Decide quality early and never remount heavy things at runtime._ Use
  cheap switches (`enabled`, `visible`, uniforms) for live adjustments.
- _Degrade settings, not the composition._ The number of objects, lights and
  shadows is art direction.
- _Don't trust performance signals during load, after a pause, or during
  user-triggered bursts._ Measure only steady state.

### 3.3 Lighter 3D effects (same look)

In `Scene.tsx`:

| Setting                               | Before | After | Why                                                                  |
| ------------------------------------- | ------ | ----- | -------------------------------------------------------------------- |
| `EffectComposer multisampling`        | 14     | 4     | 14 samples per pixel is extreme; 4 is visually indistinguishable     |
| `MeshTransmissionMaterial samples`    | 12     | 6     | refraction blur samples per pixel                                    |
| `MeshTransmissionMaterial resolution` | 512    | 256   | the glass is small on screen; a 4× smaller FBO looks the same        |
| `Environment resolution`              | 256    | 128   | reflection map for 2 small objects                                   |

Also in `LogoScene.tsx`: `dpr={[1, 1.5]}` (it defaulted to up to 2×).

**Practice.** _Match effect resolution to on-screen size._ Most quality knobs
in three.js have diminishing returns well before their max.

### 3.4 `useThemeEvent` subscribes once

**Problem.** Its `useEffect` depended on `[handler]`. Callers passed an inline
function, which is a new function on every render, so the listener was removed
and re-added on every render.

**Fix.** Keep the latest handler in a ref and subscribe once:

```ts
const handlerRef = useRef(handler);
handlerRef.current = handler;
useEffect(() => {
  const ctrl = new AbortController();
  subscribeToThemeChangedEvent(() => handlerRef.current(), ctrl.signal);
  return () => ctrl.abort();
}, []);
```

**Practice.** _The "latest ref" pattern_: stable subscription, always-fresh
callback. Don't put inline functions in effect dependency arrays.

### 3.5 `backdrop-filter` only where you can see it

**Problem.** Every `Card` had `backdrop-filter: blur(10px)`: the navbar, about
15 project cards, about 12 testimonial cards and the hero band. On most of
them nothing sits behind the card but a flat color, so the blur was invisible.
The GPU still paid for it every frame something moved, and the testimonials
move forever.

**Fix.** `Card.astro` now takes a `blur` prop:

```astro
<Card blur …>   <!-- only Navbar and testimonial cards -->
```

```css
[data-c="card"].card-blur { backdrop-filter: blur(10px); }
/* theme 1 cards have an opaque background → the blur can't be seen */
[data-theme-context="nick"][data-theme="1"] [data-c="card"].card-blur {
  backdrop-filter: none;
}
```

The blur was kept on the testimonials **on purpose**. The trail images pass
behind those cards, and the blur over them is part of the look. That was
verified in the browser before deciding.

**Practice.** _Expensive effects should be opt-in, not a default on a shared
component._ Before removing an effect, check whether it's actually visible.

### 3.6 Testimonial marquee pauses off-screen

`Testimonials/index.astro` adds an `IntersectionObserver` that toggles an
`.is-offscreen` class. The class sets the existing `--animation-state`
variable to `paused`. It also honors `prefers-reduced-motion`.

**Practice.** Same as 3.1. Accessibility and performance often point the same
way.

### 3.7 Cursor without `body:has()`

**Problem.** The custom cursor used:

```css
body:has(button:hover, a:hover, .hoverable:hover, .cursor-pointer:hover) [data-component="cursor"] …
```

`:has()` on `body` makes the hover state of _any_ element a dependency of the
cursor's style. Every hover change can trigger style re-evaluation at document
scale. The `mousemove` handler also wrote `style.transform` on every event,
and those can fire more often than frames are drawn.

**Fix (`Cursor.astro`).**

- One delegated `pointerover` listener on `document` uses `closest()` to toggle
  `is-hover` / `is-hidden`. `pointerdown`/`pointerup` toggle `is-active`. The
  CSS targets those classes, so only the cursor's own style changes.
- Position writes are batched with `requestAnimationFrame`. Many events still
  mean only **one** style write per frame:

```ts
const handleMouseMove = (e: MouseEvent) => {
  x = e.clientX; y = e.clientY;
  if (!pendingFrameId) pendingFrameId = requestAnimationFrame(applyCursorPosition);
};
```

**Practice.** _Event delegation_ (one listener, not hundreds) and _rAF
batching_ (coalesce many inputs into one write per frame). `:has()` is
powerful, but avoid it on `body`/`html` for frequently changing states.

### 3.8 Trail: 126 image nodes → 14

**Problem.** `Trail.astro` rendered the 14 images 9 times (126 `<img>`). On
top of that, `getBoundingClientRect()` ran on **every** `mousemove`.

**Fix.**

- One node per image. Images appear at most every 250 ms and each lives about
  1.2 s, so at most about 5 are visible at once. Cycling through 14 nodes is
  plenty.
- The layout read moved inside the throttled function, so it runs about 4×/s
  instead of on every move.
- Fixed a bug: the index wrapped to `14` instead of `0`.

**Practice.** _Recycle a small pool of nodes instead of rendering many copies.
Throttle before reading layout._

### 3.9 Release `will-change` after the intro

The hero title words have `will-change: opacity, transform` (one GPU layer
each). After the intro timeline completes, `HeroTitle.astro` sets it to
`auto`, so those layers are freed.

**Practice.** `will-change` is a hint to promote _before_ an animation. Leaving
it on forever wastes GPU memory and composite work.

### 3.10 Fonts: TTF 1.06 MB → WOFF2 39 KB, preloaded

**Problem.** Two full-coverage TTF files (630 KB + 428 KB), discovered late
(only once the CSS was parsed). The first Reshape switched to the sans font,
so the browser downloaded and decoded it right then, during the animation.
That was part of the Reshape freeze.

**Fix.**

1. Subset to Latin + punctuation and compress as WOFF2 (Brotli) with
   `fonttools`:
   ```
   pyftsubset NotoSans-Light.ttf --flavor=woff2 --layout-features='*' \
     --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122,…"
   ```
2. `fonts.css` lists WOFF2 first, with the TTF as a fallback.
3. `Layout.astro` preloads both, so they download in parallel with the HTML:
   ```html
   <link rel="preload" href="/fonts/NotoSans-Light.woff2" as="font" type="font/woff2" crossorigin />
   ```
   `crossorigin` is required even for same-origin fonts. Without it the
   preload is fetched twice.

**Practice.** _Subset, WOFF2, preload, `font-display: swap`._ Preload only
fonts used above the fold or during key interactions.

### 3.11 Responsive images

- **Project covers** (`ProjectCard.astro`): `<Picture>` gets
  `widths={[400, 640, 960, 1280]}` plus a `sizes` attribute that describes the
  card width per breakpoint. The browser then picks the smallest file that is
  sharp enough, so phones stop downloading desktop-size images.
  `decoding="async"` keeps image decoding off the critical path.
- **Testimonial avatars**: `densities={[1, 2]}` gives a 70px and a 140px
  version, so high-density screens stay sharp and normal screens download less.

**Practice.** _`srcset` + `sizes` on every content image; lazy-load below the
fold._

### 3.12 Lighter GSAP imports

`Section.astro` and `Shift.astro` imported `ScrollTrigger` from `"gsap/all"`,
which pulls in every GSAP plugin. They now import from `"gsap/ScrollTrigger"`.

**Practice.** _Import from the specific entry point_ so the bundler can drop
what you don't use.

### 3.13 Remove unused dependencies

`@astrojs/cloudflare`, `@astrojs/netlify`, `@astrojs/partytown`,
`@astrojs/vue` and `vue` were installed but never used. `astro.config.mjs`
only registers `react()` and `sitemap()`, and the site uses
`output: "static"` with no adapter. Removing them took 21 packages out of
`node_modules` and about 1,900 lines out of `pnpm-lock.yaml`.

Some packages look unused in a search but **are** needed:

- `react-dom`: required by `@astrojs/react` to render and hydrate islands.
- `sharp`: used by Astro's image service (`<Image>`, `<Picture>`).
- `@types/*`: only used by TypeScript, never imported directly.
- `tailwindcss`: imported from CSS (`@import "tailwindcss"`), not from JS.

**Practice.** _Before removing a dependency, search for imports **and** for
indirect uses_ (peer dependencies, CSS imports, config files, build-time
services). Then run `pnpm build` to confirm.

---

## 4. What was tried and reverted

These are as instructive as the changes that stayed.

1. **Dynamic `dpr` from `PerformanceMonitor`'s `factor`.** It forced a fixed
   number (1.4) even on a 1× screen, rendering **more** pixels than the
   screen has (3563px canvas for 2545 CSS px). Each change also resized every
   FBO, which caused a 99 ms stall. _Lesson: a range like `dpr={[1, 1.5]}`
   lets R3F clamp to the real `devicePixelRatio`; resizing render targets is
   expensive._
2. **`transmissionSampler` on the low tier.** The idea was to reuse three.js's
   shared transmission pass instead of a private FBO. In practice the page
   dropped to **1.5 fps**. It was found by stashing the changes, measuring the
   original (143 fps), and narrowing down the difference. _Lesson: measure
   every "optimization"; bisect when something regresses._
3. **Removing shadows.** The reasoning was that `meshBasicMaterial` doesn't
   receive shadows, so the shadow pass was wasted. But the shadows are part of
   the portfolio's look, so they were restored exactly. _Lesson: art direction
   is a requirement, not a nice-to-have. Ask before trading visuals for
   speed._ (It also turned out that most of the visible "shadow" is the AO
   pass, see 3.2.)
4. **One-way degrade ("drop to low once and stay there").** It fixed the
   flip-flop stalls, but low still meant "unmount AO and remove a glass
   shape". A burst of Reshape clicks or the intro's slow frames could trigger
   it, so shadows and a cube vanished for the rest of the visit. It was
   replaced by the current design: a fixed tier for settings, and a runtime
   toggle of AO only via `enabled`. _Lesson: if degrading is irreversible,
   a false alarm is permanent. Make runtime switches cheap and reversible._
5. **Not changed, deliberately:**
   - The global `* { transition: background-color, opacity, border-radius }`:
     nearly every element relies on it for the theme crossfade.
   - Hydrating the hero with `client:idle`: it would desync the 3D fade-in
     from the band opening.
   - The `setTimeout(…, 50)` ScrollTrigger workarounds: risk breaking the
     projects pin.

---

## 5. How to measure and test

**Measure before changing anything, and after every change.** A fast machine
hides problems, so also test throttled and on real weak devices.

### Quick in-page fps probe (paste in DevTools console)

```js
let n = 0, worst = 0, last = performance.now(); const t0 = last;
await new Promise((r) => { const f = (t) => { n++; worst = Math.max(worst, t - last); last = t;
  t - t0 < 2000 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
({ fps: n / 2, worstFrameMs: Math.round(worst) });
```

### Long Animation Frames (what froze, and for how long)

```js
performance.getEntriesByType("long-animation-frame")
  .filter((e) => e.duration > 50)
  .map((e) => [Math.round(e.startTime), Math.round(e.duration)]);
```

Use a `PerformanceObserver` with `{ type: "long-animation-frame" }` to watch a
specific interaction such as Reshape.

### DevTools

- **Performance panel** → record while scrolling and pressing Reshape. Look
  for red bars (long tasks), purple (style/layout) and green (paint/GPU).
- **CPU throttling 4× / 6×** (Performance panel ⚙) approximates a weak laptop.
  GPU can't be throttled, so test on real hardware too.
- **Rendering tab** → _Paint flashing_ and _Layer borders_ show what repaints
  and what has its own layer.
- **Lighthouse** (mobile) on `pnpm build && pnpm preview`, not on the dev
  server. Dev mode serves unbundled modules and is much slower.

### Project-specific

- `http://localhost:4321/?quality=low` / `?quality=high` forces a tier.
- **Spam test:** click Reshape rapidly 30 to 50 times, wait 3 s, and check
  that all cubes, both glass shapes and the contact shading are still there.
  From the console:
  ```js
  const b = document.querySelector("#reshape-btn");
  for (let i = 0; i < 45; i++) { b.click(); await new Promise((r) => setTimeout(r, 120)); }
  ```
- Test on: a laptop with integrated Intel graphics, a mid-range Android phone,
  and an iPhone.

---

## 6. Best-practice checklist

**Rendering**

- [ ] Animate only `transform` and `opacity` when possible (compositor-only).
- [ ] Never animate what isn't visible: `IntersectionObserver` + pause.
- [ ] Batch DOM writes in `requestAnimationFrame`; never read layout in a
      high-frequency handler without throttling.
- [ ] Prefer delegated listeners and class toggles over `body:has()` for
      hover/active states.
- [ ] Treat `backdrop-filter`, `filter` and `mix-blend-mode` as budgeted
      effects: opt-in, only where visible.
- [ ] Use `will-change` temporarily, then release it.

**WebGL / R3F**

- [ ] Cap `dpr` with a range (`[1, 1.5]`), never a fixed number.
- [ ] Pause the loop off-screen (`frameloop="never"`).
- [ ] Count passes: shadows, transmission FBOs and post-processing each
      re-render the scene.
- [ ] Size effect buffers to on-screen size; avoid maxed-out samples.
- [ ] Pick a quality tier once at load; never mount and unmount heavy things
      at runtime.
- [ ] Runtime quality switches must be cheap and reversible (`enabled`,
      `visible`, uniforms), never a remount.
- [ ] Ignore fps signals during load, after a pause, and during user-triggered
      bursts.
- [ ] Degrade settings (resolution, samples, half-res passes), never the
      composition (objects, lights, shadows).

**Assets**

- [ ] Fonts: subset + WOFF2 + preload + `font-display: swap`.
- [ ] Images: `srcset`/`sizes` (`widths`, `densities` in Astro), lazy below
      the fold.
- [ ] Recycle small DOM pools instead of rendering many copies.
- [ ] Import specific entry points (`gsap/ScrollTrigger`, not `gsap/all`).

**Process**

- [ ] Measure first, on weak hardware or throttled.
- [ ] Change one thing, measure again; revert what doesn't help.
- [ ] Bisect regressions (stash, compare against the original).
- [ ] The art direction is a requirement: verify visually after every change.
