# How this site works (plain-language architecture doc)

This doc explains every moving piece of the portfolio in simple terms.
Read it top to bottom once and you will understand the whole codebase.

## The one-sentence version

The whole site is **one HTML file** served by GitHub Pages; there is no
build step, no server, and no database, and when you "publish" a blog post
the site commits a JSON file to this repo using the GitHub API.

## The mental model

Think of it like a single-player game cartridge:

- `index.html` is the cartridge. Everything is inside it: the styling, the
  pixel monsters, the cursor effects, and the React app.
- `data/posts.json` and `data/projects.json` are the save files. The
  cartridge works without them (it has built-in defaults), but if the save
  files exist, they win.
- `publish/` is the memory-card writer. It knows how to write new save
  files back to GitHub.

## What happens when someone opens the site

1. The browser downloads `index.html`.
2. Inline `<script>` blocks run in order:
   - **Tweak defaults** set the theme, accent color, cursor style, and the
     owner password hash on `window.TWEAK_DEFAULTS`.
   - **Monster renderer** defines the 11 pixel familiars and starts a
     draw loop (see "Monsters" below).
   - **Cursor engine** starts drawing the custom cursor on a canvas.
   - **Scroll + pointer helpers** track scroll progress and mouse position
     into CSS variables (`--scroll-y`, `--mx`, `--my`, `--px`, `--py`).
3. The publish layer scripts load (`publish/*.js`) and immediately start
   fetching `data/*.json` in the background.
4. React and Babel load from unpkg. Babel converts the JSX inside
   `index.html` into normal JavaScript **in the browser** (that is why
   there is no build step).
5. The React app renders whatever page the URL hash says (`#/projects`,
   `#/blog`, and so on).

## Routing (how pages change without reloads)

The router is 10 lines. The URL hash (`#/projects/ovat`) is split into
two parts, `a` and `b`. A React hook listens for `hashchange` events and
re-renders. That is the entire router. No library.

## Theming (how one accent color drives everything)

Every color on the site is written in OKLCH with one variable for the hue:
`--accent-h`. Picking "gold" in the theme panel just changes that one hue
number, and every glow, button, chip, monster halo, cursor, and aurora blob
recolors itself. Dark/light/dracula/etc. are blocks of CSS variables under
`[data-mode="..."]` on the `<html>` tag.

Settings live in `localStorage` under `gurman.tweaks.v2`. On every change,
`applyTweaks()` copies them onto `<html>` as `data-` attributes, and CSS
reacts to those attributes.

## Monsters (the pixel familiars)

Each monster is a 16x16 grid of letters in `window.__MONSTERS`:

```
.  = empty          B = body color      S = shade
L  = outline        H = highlight       E = eye
A  = accent (pulses)                    R = flat gold (Aureon's wheel)
```

A single `requestAnimationFrame` loop redraws every mounted monster canvas
each frame. The renderer adds cel-shading (light top half, dark bottom
half of each cell), an outline pass, eye glints, and idle animations
(hover, flutter, stomp...) defined per monster.

**Cursor reactivity:** the loop knows where your mouse is. For each canvas
it computes the direction from the monster to the pointer, then:
- slides the eye pixels a fraction of a cell toward you,
- leans the whole body a few degrees toward you,
- makes the monster hop when the pointer comes within 200px.

**Aureon** (the legendary) is generated with a real circle equation for
its gold wheel, uses the extra `R` palette letter so the wheel renders
flat gold instead of getting the white "spark" overlay other accent cells
get, and gets a full-width gold slot in the hero roster.

## Cursor engine

`data-cursor` on `<html>` picks one of 8 modes (or `off`). Two DOM
elements (a dot and a trailing ring) follow the pointer, and a full-screen
canvas draws the fancy parts:

- **comet**: keeps the last ~36 mouse positions and strokes them as a
  tapering, fading line.
- **ribbon**: same history, but drawn as a filled silk strip.
- **blade**: a velocity-stretched streak in your direction of travel.
- **nova / pixel / spark / terminal / crosshair**: particles (orbiting
  dots, snapped squares, gravity sparks, falling glyphs, bracket pulses).

One CSS variable `--cur` decides the cursor color: bright accent on dark
themes, deep accent on light. The canvas uses additive blending only on
dark themes; on light it uses normal blending so nothing washes out.

## Aurora background

Three big blurred color blobs (`.aurora i`) drift on slow keyframe
animations. The parent layer moves up to 70px against your mouse
(parallax) and recedes as you scroll. A separate `.pointer-glow` layer
paints a soft accent pool exactly at your cursor. Both are keyed off
`--accent-h`, so they recolor with the theme, and both are disabled when
motion is set to "none".

## Scroll animations

Two systems, deliberately redundant:

1. **IntersectionObserver reveals** (no dependencies): anything with class
   `.reveal` fades/slides in when it enters the viewport. This always works.
2. **GSAP ScrollTrigger** (loaded from a CDN): if it loads, it takes over
   the hero (stage sinks, title drifts as you scroll) and the section
   headers (scrubbed reveal tied to scroll position). If the CDN is
   blocked, the site silently falls back to system 1.

## The publish layer (how blog posts get onto the site)

Files in `publish/`, loaded in this order:

- `auth-store.js`: remembers your GitHub token and repo settings in
  localStorage. Can encrypt the token with a passphrase (AES-GCM).
- `github-api.js`: a tiny GitHub REST client (get file, put file, open PR).
- `data-store.js`: fetches `data/*.json`, falls back to the inline
  defaults, and notifies React when data changes.
- `publish-queue.js`: if a publish fails (offline, rate limit), it waits
  in localStorage and retries later.
- `publisher.js`: the brain. "Publish this post" becomes: fetch current
  posts.json from GitHub, merge in the new post, commit the file back.
- `owner-console.jsx`: the settings screen at `#/console`.
- `publish-button.jsx`: the reusable Publish button.

The flow when you hit publish:

```
editor -> Publisher.publishPost()
       -> GithubAPI.getFile("data/posts.json")   (read + version sha)
       -> merge your post into the list
       -> GithubAPI.putFile(...)                 (commit to main)
       -> GitHub Pages redeploys (~30s)
       -> DataStore.replace() updates the UI immediately
```

## Owner mode and security

Two separate locks, and it is important to understand the difference:

1. **Owner password** (footer -> owner sign-in): its SHA-256 hash is baked
   into `index.html`. Entering the right password only *shows* the editor
   UI in your browser. It grants zero write power. Anyone could bypass it
   with dev tools and still be unable to change the site.
2. **GitHub token** (Console -> Connection): this is the real key. It is a
   fine-grained PAT scoped to just this repo, stored only in your browser.
   Without it, nothing can be committed.

Other protections:
- CSP meta tag: scripts may only load from this site and unpkg (with
  SRI hashes pinning exact file contents); the page may only talk to the
  four APIs it actually uses (HN, GitHub, FormSubmit, Cloudflare DNS).
- Markdown is escaped before rendering, so a post cannot inject HTML.
- Link URLs are scheme-checked (no `javascript:` links).
- The contact form validates the sender's email domain has a mail server
  (via DNS-over-HTTPS) and has a honeypot field for naive bots.

## CI (GitHub Actions)

- `pages.yml`: on every push to main, publish the repo root to Pages as-is.
- `site-hooks.yml`: when `data/*.json` changes, regenerate `sitemap.xml`
  and the social-preview image `og.png`, then commit them back with
  `[skip ci]` so it does not loop forever.

## Things to know before editing

- Edit `index.html`, reload. That is the whole dev loop.
  (`python3 -m http.server 8000` and open localhost:8000.)
- If you edit `publish/*.jsx`, bump the `?v=` query on their script tags
  in `index.html`, or browsers keep the old cached version for hours.
- New post fields or monster letters: search `window.__POSTS` /
  `window.__MONSTERS` in `index.html`; the comments above them describe
  every field.
- The inline data arrays are only *defaults*. Once `data/*.json` exists,
  the JSON wins. Keep them roughly in sync so the site works even if the
  JSON fetch fails.
