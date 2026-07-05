# Portfolio: gurman s.

Live at **https://lagmator22.github.io/Portfolio**

A single-file, no-build portfolio: `index.html` carries the design system, the
pixel-monster renderer, the cursor FX, and the React app (transpiled in the
browser by Babel standalone). GitHub Pages serves the repo root as-is. There is no bundler, no server, no database.

```
index.html              the whole site, tokens/CSS, monsters, cursor FX, React app
data/
  posts.json            published blog posts   (canonical; overrides inline fallback)
  projects.json         published projects
publish/
  auth-store.js         GitHub PAT persistence (+ optional AES-GCM passphrase lock)
  github-api.js         minimal GitHub REST client
  data-store.js         JSON-first loader with inline fallback
  publish-queue.js      offline retry queue
  publisher.js          high-level publish ops (commit / PR)
  owner-console.jsx     the /#/console screen
  publish-button.jsx    reusable publish control
.github/workflows/
  pages.yml             deploys repo root to Pages on push to main
  site-hooks.yml        regenerates sitemap.xml + og.png when data/*.json changes
```

## How to publish a blog post (the dispatch)

Everything happens in the browser on the live site, no laptop required.

1. **One-time setup**
   - Open the site → footer → *owner sign-in* → enter the owner password.
   - Go to `#/console` (a "console" link appears in the nav once signed in).
   - Create a **fine-grained PAT** at github.com/settings/personal-access-tokens/new
     scoped to *only this repo* with **Contents: Read & Write**.
   - Paste it in the Connection panel → *save & verify*. Optionally lock it
     with a passphrase in the Security panel (AES-GCM at rest).
2. **Write**
   - Go to `#/blog` → **+ new post** → write in the editor (live preview,
     markdown subset: `LEAD:`, `##`, `>`, lists, fenced code, links).
3. **Publish**
   - Click **publish**. The post is committed to `data/posts.json` via the
     GitHub API, Pages redeploys (~30s), and the post is live. In *staged*
     mode it opens a PR instead of committing straight to main.

If the network drops mid-publish, the post waits in the offline queue
(Console → Retry panel) and retries automatically.

### Rotating the owner password

```sh
echo -n "your-new-password" | shasum -a 256
```

Paste the hex into `TWEAK_DEFAULTS.ownerHash` at the top of `index.html`,
commit, push. Note the owner unlock is **UI gating only**, actual write
access always requires the PAT.

## Local development

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

No build step. Edit `index.html`, reload. When you edit the `publish/*.jsx`
files, bump the `?v=` query on their `<script>` tags so browsers drop the
stale cache.

## Security posture

- CSP with explicit allowlists (`script-src` limited to self + SRI-pinned
  unpkg; `connect-src` limited to the four APIs the site actually calls).
- React pinned with subresource integrity hashes.
- Owner password never in source, only its SHA-256.
- The PAT lives only in the owner's browser (localStorage, optionally
  AES-GCM-encrypted with PBKDF2).
- Markdown rendering escapes HTML before formatting; URLs are scheme-filtered.
