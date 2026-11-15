# Portfolio: Gurman Singh

Live at **https://gurman.is-a.dev**

A static site with four pages: Home, OVAT, Journey and Writing. No framework,
no backend, no third-party scripts. A small Node script with zero dependencies
turns the content files into HTML, and GitHub Actions publishes the result on
every push to `main`.

```
content/site.json         name, status line, links, education, skills
content/projects.json     projects (home page, terminal mode)
content/journey.json      experience, open source, hackathons, honors
content/opensource.json   merged pull requests
posts/*.md                blog posts and link posts
pages/*.html              hand-written page bodies (home, ovat, journey)
assets/                   styles, scripts, fonts, share image
scripts/build.mjs         the build: writes _site/
```

## Write a post

1. Copy `posts/_template.md` to `posts/2026-12-01-my-title.md`.
2. Fill in `title`, `date` and `summary`, then write Markdown below the block.
3. Commit and push. It is live in about a minute, at `/blog/my-title/`.

This works from the GitHub website or phone app too: open `posts/`, choose
**Add file**, paste, commit.

## Share a link (an X post, a LinkedIn post, a talk)

Same thing, but with a `link:` line and no body:

```
---
title: Thread on debugging a KV cache leak
date: 2026-12-01
summary: One line about it.
link: https://x.com/ArenaOfGods_/status/123
---
```

It shows up in the Writing list and opens the link directly.

## Add an achievement or a job

Add an entry at the top of `content/journey.json`:

```json
{
  "when": "Jan 2027",
  "kind": "honor",
  "title": "What happened",
  "detail": "One or two sentences.",
  "url": "https://optional.link"
}
```

`kind` is one of `experience`, `open-source`, `hackathon`, `honor`, `education`.

## Add a project

Add an entry to `content/projects.json`. Give it `"minor": true` to list it
under "Also", or a `"sprite"` to give it a full row. Sprites are 16 x 16 pixel
grids defined in the `SPRITES` table at the top of `assets/site.js`.

## Preview locally

```sh
node scripts/build.mjs
python3 -m http.server 8000 -d _site
```

If a content file has a mistake, the build stops with a message naming the
file, and the live site stays as it was.

## Security

- Strict Content-Security-Policy: scripts, styles and fonts load only from this
  site. No inline scripts or styles, no third-party requests, no network calls
  from the page.
- Everything from `content/` and `posts/` is HTML-escaped at build time, and
  links are limited to http(s), mailto and relative URLs.
- No forms, logins, tokens or cookies. Nothing to steal.
- The workflow has least-privilege permissions, and its actions are pinned to
  commit SHAs.
- Fonts are IBM Plex, self-hosted under the SIL Open Font License
  (`assets/fonts/OFL.txt`).
