#!/usr/bin/env node
/* ============================================================
 * Site build. No dependencies: `node scripts/build.mjs`.
 *
 *   content/*.json   profile, projects, open source, journey
 *   posts/*.md       blog posts and link posts
 *   pages/home.html  home page body
 *   assets/          styles, scripts, fonts, images
 *        |
 *        v
 *   _site/           what GitHub Pages serves
 *
 * Everything that comes from content/ or posts/ is HTML-escaped
 * here, so a stray "<" in a post can never become markup.
 * ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function json(path) {
  try { return JSON.parse(read(path)); }
  catch (e) { fail(`${path} is not valid JSON: ${e.message}`); }
}
function fail(msg) { console.error(`\nBuild failed: ${msg}\n`); process.exit(1); }

/* ---------- escaping ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Only http(s), mailto and relative URLs survive; anything else (javascript:, data:) is dropped. */
function safeUrl(u) {
  u = String(u ?? '').trim();
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '#';
  return u;
}
const isExternal = (u) => /^https?:\/\//i.test(u);
const ext = (u) => (isExternal(u) ? ' target="_blank" rel="noopener noreferrer"' : '');
const ARROW = '<svg class="arrow" aria-hidden="true"><use href="#arrow"/></svg>';

/* ---------- content ---------- */
const site = json('content/site.json');
const projects = json('content/projects.json');
const opensource = json('content/opensource.json');
const journey = json('content/journey.json');
const SITE_URL = site.url.replace(/\/$/, '');

/* ---------- posts ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y}`; };

function platform(url) {
  let host;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Link'; }
  const known = { 'x.com': 'X', 'twitter.com': 'X', 'linkedin.com': 'LinkedIn', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
    'github.com': 'GitHub', 'pypi.org': 'PyPI', 'ethglobal.com': 'ETHGlobal', 'devpost.com': 'Devpost', 'medium.com': 'Medium' };
  return known[host] || host;
}

function loadPosts() {
  const dir = join(ROOT, 'posts');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!m) fail(`posts/${file} must start with a "---" block holding title and date.`);
      const meta = {};
      m[1].split('\n').forEach((line) => {
        const i = line.indexOf(':');
        if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      });
      const fromName = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
      const date = meta.date || (fromName && fromName[1]);
      if (!meta.title) fail(`posts/${file} needs a "title:" line.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(`posts/${file} needs a "date:" line like 2026-01-31.`);
      const slug = (fromName ? fromName[2] : file.replace(/\.md$/, '')).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      const link = meta.link ? safeUrl(meta.link) : '';
      if (meta.link && !isExternal(link)) fail(`posts/${file}: "link:" must be a full https:// URL.`);
      return { file, slug, date, title: meta.title, summary: meta.summary || '', link, body: m[2].trim(), draft: meta.draft === 'true' };
    })
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
const posts = loadPosts();

/* ---------- markdown (a small, safe subset) ---------- */
function inline(text) {
  return text.split(/(`[^`]+`)/).map((part) => {
    if (/^`[^`]+`$/.test(part)) return `<code>${esc(part.slice(1, -1))}</code>`;
    return esc(part)
      .replace(/!?\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, url) => {
        if (all[0] === '!') return all;
        const u = safeUrl(url.replace(/&amp;/g, '&'));
        return `<a href="${esc(u)}"${ext(u)}>${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  }).join('');
}

function card(url) {
  return `<a class="card" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span><b>Open on ${esc(platform(url))}</b><span>${esc(url.replace(/^https?:\/\//, ''))}</span></span>${ARROW}</a>`;
}

function markdown(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const flushList = (tag, items) => out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    } else if (/^\s*$/.test(line)) {
      i++;
    } else if (/^#{1,3}\s+/.test(line)) {
      const level = line.match(/^#+/)[0].length >= 3 ? 3 : 2;
      out.push(`<h${level}>${inline(line.replace(/^#+\s+/, ''))}</h${level}>`);
      i++;
    } else if (/^---+\s*$/.test(line)) {
      out.push('<hr>'); i++;
    } else if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
    } else if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ''));
      flushList('ul', items);
    } else if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ''));
      flushList('ol', items);
    } else if (/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.test(line)) {
      const [, alt, url] = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
      // images are local only: posts/img/<file> is published at /blog/img/<file>
      const name = url.replace(/^(\.\/)?img\//, '');
      if (/^[a-z0-9._-]+$/i.test(name)) out.push(`<img src="../img/${esc(name)}" alt="${esc(alt)}" loading="lazy">`);
      i++;
    } else if (/^https?:\/\/\S+$/.test(line.trim())) {
      out.push(card(line.trim())); i++;
    } else {
      const para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(```|#{1,3}\s|>\s?|[-*]\s|\d+\.\s|---+\s*$)/.test(lines[i])) para.push(lines[i++]);
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

/* ---------- shared page shell ---------- */
/* Asset URLs carry a content hash so a deploy is never masked by a cached stylesheet or script. */
const stamp = createHash('sha1');
['assets/site.css', 'assets/site.js', 'assets/theme.js', 'content/site.json', 'content/projects.json', 'content/opensource.json', 'content/journey.json']
  .forEach((f) => stamp.update(read(f)));
readdirSync(join(ROOT, 'posts')).sort().forEach((f) => { if (f.endsWith('.md')) stamp.update(read(`posts/${f}`)); });
const V = stamp.digest('hex').slice(0, 10);
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'";

/* label, href from the site root, and the page it marks as current */
const NAV = [['Work', '#work', ''], ['OVAT', 'ovat/', 'ovat'], ['Journey', 'journey/', 'journey'], ['Writing', 'blog/', 'blog'], ['Contact', '#contact', '']];

function shell({ rel, path, title, description, body, type = 'website', current = '' }) {
  const url = SITE_URL + path;
  const sameAs = site.links.map((l) => l.url);
  const ld = { '@context': 'https://schema.org', '@type': 'Person', name: site.name, url: SITE_URL + '/', jobTitle: 'Systems programmer', sameAs };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#f4f4f2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1012" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${SITE_URL}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE_URL}/assets/og.png">
<link rel="icon" href="${rel}assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="${rel}feed.xml">
<link rel="preload" href="${rel}assets/fonts/IBMPlexSans-Medium-Latin1.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/IBMPlexSans-Regular-Latin1.woff2" as="font" type="font/woff2" crossorigin>
<script src="${rel}assets/theme.js?v=${V}"></script>
<link rel="stylesheet" href="${rel}assets/site.css?v=${V}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<script src="${rel}assets/data.js?v=${V}" defer></script>
<script src="${rel}assets/site.js?v=${V}" defer></script>
</head>
<body>
<svg class="defs" aria-hidden="true"><symbol id="arrow" viewBox="0 0 12 12"><path d="M2.5 9.5l7-7M4 2.5h5.5V8"/></symbol></svg>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap site-head__in">
    <a class="brand" href="${rel || './'}">${esc(site.name)}</a>
    <nav class="site-nav" aria-label="Sections">
      ${NAV.map(([label, href, key]) => `<a href="${rel}${href}"${key && key === current ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
    </nav>
    <button class="tui-btn" type="button" data-tui-open aria-label="Open terminal mode"><span aria-hidden="true">&gt;_</span><span class="tui-btn__t" aria-hidden="true">terminal</span></button>
    <button class="theme-btn" type="button" aria-label="Switch color theme">
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="9" cy="9" r="7"/><path d="M9 2a7 7 0 0 0 0 14z" fill="currentColor"/></svg>
    </button>
  </div>
  <div class="track" aria-hidden="true"></div>
  <canvas class="sprite walker" width="16" height="16" data-sprite="ovat" data-walker aria-hidden="true"></canvas>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot wrap">
  <span>© ${new Date().getFullYear()} ${esc(site.name)}</span>
  <nav aria-label="Footer">
    <a href="${rel}blog/">Writing</a>
    <a href="${rel}feed.xml">RSS</a>
    <a href="https://github.com/Lagmator22/Portfolio" target="_blank" rel="noopener noreferrer">Source</a>
  </nav>
</footer>
</body>
</html>
`;
}

/* ---------- home page pieces ---------- */
const withSprite = projects.filter((p) => p.sprite);
const mainProjects = projects.filter((p) => p.sprite);
const minor = projects.filter((p) => p.minor);

const lineup = withSprite.map((p, i) =>
  `<a href="#${esc(p.id)}"><span class="lineup__stand"><canvas class="sprite" width="16" height="16" data-sprite="${esc(p.sprite)}" data-delay="${700 + i * 130}" aria-hidden="true"></canvas></span><span class="lineup__name mono">${esc(p.name)}</span></a>`
).join('\n    ');

const linkList = (links) => links.map((l) => `<a class="link" href="${esc(safeUrl(l.url))}"${ext(l.url)}>${esc(l.label)} ${ARROW}</a>`).join('\n          ');

const projectsHtml = mainProjects.map((p) => {
  // a project with its own page links there first; the rest link to their first link
  const links = p.page ? [{ label: 'Full write-up', url: p.page }].concat(p.links) : p.links;
  const first = links[0];
  const name = first ? `<a href="${esc(safeUrl(first.url))}"${ext(first.url)}>${esc(p.name)}</a>` : esc(p.name);
  const shown = (p.facts || []).slice(0, 3);
  const facts = shown.length
    ? `<dl class="facts">${shown.map((f) => `<div><dt>${esc(f.value)}</dt><dd>${esc(f.label)}</dd></div>`).join('')}</dl>` : '';
  const kicker = p.flagship ? `<p class="project__kicker mono"><i></i>Flagship · ${esc(p.context)}</p>` : '';
  return `<article class="project${p.flagship ? ' project--flag' : ''}" id="${esc(p.id)}" data-reveal>
      <canvas class="sprite" width="16" height="16" data-sprite="${esc(p.sprite)}" role="img" aria-label="${esc(p.name)} sprite"></canvas>
      <div>
        ${kicker}
        <h3>${name}</h3>
        <p class="project__tag">${esc(p.tagline)}</p>
        <p class="project__desc">${esc(p.description)}</p>
        ${facts}
        <p class="mono">${esc(p.stack)}</p>
        <div class="links">
          ${linkList(links)}
        </div>
      </div>
    </article>`;
}).join('\n    ');

function row({ url, mono, title, note, tag }) {
  const inner = `${mono ? `<span class="mono">${esc(mono)}</span>` : ''}<span class="row__main"><span class="row__title">${esc(title)}</span>${note ? `<span class="row__note">${esc(note)}</span>` : ''}</span>${tag ? `<span class="row__tag">${esc(tag)}</span>` : ''}`;
  return url
    ? `<a class="row" href="${esc(safeUrl(url))}"${ext(url)}>${inner}${ARROW}</a>`
    : `<div class="row">${inner}</div>`;
}

const alsoHtml = minor.map((p) => row({ url: p.links[0] && p.links[0].url, title: p.name, note: `${p.tagline} ${p.description}` })).join('\n      ');
const ossRow = (o) => row({ url: o.url, mono: `${o.repo} #${o.number}`, title: o.title, note: o.note });
const ossOpenvino = opensource.filter((o) => o.repo === 'openvino').map(ossRow).join('\n      ');
const ossOther = opensource.filter((o) => o.repo !== 'openvino').map(ossRow).join('\n      ');
const ossTop = opensource.filter((o) => o.repo === 'openvino').slice(0, 3).map((o) => row({ url: o.url, mono: `#${o.number}`, title: o.title })).join('\n      ');

const KINDS = { experience: 'Experience', 'open-source': 'Open source', hackathon: 'Hackathons', honor: 'Honors', education: 'Education' };
journey.forEach((j, i) => { if (!KINDS[j.kind]) fail(`content/journey.json entry ${i + 1}: "kind" must be one of ${Object.keys(KINDS).join(', ')}.`); });
const kindLabel = { experience: 'Experience', 'open-source': 'Open source', hackathon: 'Hackathon', honor: 'Honor', education: 'Education' };
const journeyHtml = journey.map((j) => {
  const title = j.url ? `<a href="${esc(safeUrl(j.url))}"${ext(j.url)}>${esc(j.title)}</a>` : esc(j.title);
  return `<li data-kind="${esc(j.kind)}"><p class="mono">${esc(j.when)} · ${kindLabel[j.kind]}</p><h3 class="journey__title">${title}</h3><p class="journey__detail">${esc(j.detail)}</p></li>`;
}).join('\n    ');
const filterKinds = ['experience', 'open-source', 'hackathon', 'honor'].filter((k) => journey.some((j) => j.kind === k));
const journeyFilters = [`<button class="chip" type="button" data-filter="all" aria-pressed="true">All <span>${journey.length}</span></button>`]
  .concat(filterKinds.map((k) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="false">${KINDS[k]} <span>${journey.filter((j) => j.kind === k).length}</span></button>`))
  .join('\n      ');

const postRow = (p, rel) => row({
  url: p.link || `${rel}blog/${p.slug}/`,
  mono: niceDate(p.date),
  title: p.title,
  note: p.summary,
  tag: p.link ? platform(p.link) : 'Post'
});
const feedHtml = (list, rel) => (list.length ? list.map((p) => postRow(p, rel)).join('\n      ') : '<p class="empty">Nothing here yet.</p>');

const specs = [`<div><dt>Education</dt><dd>${esc(site.education.degree)}, ${esc(site.education.school)}. ${esc(site.education.when)}.</dd></div>`]
  .concat(site.skills.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)).join('\n      ');

const heroLinks = linkList(site.links) + `\n          <a class="link" href="#contact" data-email>Email ${ARROW}</a>`;
const bigLinks = [`<a class="biglink" href="#contact" data-email><span>Email</span> ${ARROW}</a>`]
  .concat(site.links.map((l) => `<a class="biglink" href="${esc(safeUrl(l.url))}"${ext(l.url)}><span>${esc(l.label)}</span> ${ARROW}</a>`)).join('\n    ');

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (all, key) => {
    if (!(key in values)) fail(`pages/home.html uses {{${key}}}, which the build does not know.`);
    return values[key];
  });
}

/* ---------- write ---------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const write = (p, content) => { mkdirSync(dirname(join(OUT, p)), { recursive: true }); writeFileSync(join(OUT, p), content); };

cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
if (existsSync(join(ROOT, 'posts/img'))) cpSync(join(ROOT, 'posts/img'), join(OUT, 'blog/img'), { recursive: true });
write('.nojekyll', '');
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// pages written by hand in pages/, filled from content/
const values = (rel) => ({
  rel, arrow: ARROW, status: esc(site.status), links: heroLinks, lineup, projects: projectsHtml, also: alsoHtml,
  oss_top: ossTop, oss_openvino: ossOpenvino, oss_other: ossOther, journey_filters: journeyFilters, journey: journeyHtml,
  specs, biglinks: bigLinks
});
const page = (file, rel) => fill(read(file).replace(/<!--[\s\S]*?-->\s*/, ''), values(rel));
const ovat = projects.find((p) => p.id === 'ovat');

write('index.html', shell({ rel: '', path: '/', title: `${site.name} · Systems programmer, local AI inference`, description: site.description, body: page('pages/home.html', '') }));
write('ovat/index.html', shell({
  rel: '../', path: '/ovat/', current: 'ovat', title: `OVAT · ${site.name}`,
  description: `${ovat.tagline} Built by ${site.name} for Google Summer of Code 2026 with Intel OpenVINO.`, body: page('pages/ovat.html', '../')
}));
write('journey/index.html', shell({
  rel: '../', path: '/journey/', current: 'journey', title: `Journey · ${site.name}`,
  description: `Experience, open source contributions, hackathons and honors of ${site.name}.`, body: page('pages/journey.html', '../')
}));

// blog index
write('blog/index.html', shell({
  rel: '../', path: '/blog/', current: 'blog', title: `Writing · ${site.name}`,
  description: `Posts by ${site.name}, and links to things posted elsewhere.`,
  body: `<section class="page-head wrap">
  <h1 data-words>Writing</h1>
  <p data-reveal data-delay="250">Posts, and links to things I post elsewhere.</p>
</section>
<section class="feed wrap">
  <div class="rows" data-reveal data-delay="350">
      ${feedHtml(posts, '../')}
  </div>
</section>`
}));

// posts with a body get their own page
posts.filter((p) => !p.link).forEach((p) => {
  write(`blog/${p.slug}/index.html`, shell({
    rel: '../../', path: `/blog/${p.slug}/`, current: 'blog', type: 'article', title: `${p.title} · ${site.name}`,
    description: p.summary || `${p.title}, by ${site.name}.`,
    body: `<article class="post wrap">
  <a class="link post__back" href="../">${ARROW} Writing</a>
  <h1>${esc(p.title)}</h1>
  <p class="post__meta mono"><time datetime="${p.date}">${niceDate(p.date)}</time> · ${esc(site.name)}</p>
  <div class="prose">
${markdown(p.body)}
  </div>
</article>`
  }));
});

// 404 (served from any depth, so it uses root-relative paths)
write('404.html', shell({
  rel: '/', path: '/404.html', title: `Not found · ${site.name}`, description: 'This page does not exist.',
  body: `<section class="page-head wrap">
  <h1 data-words>Nothing here.</h1>
  <p data-reveal data-delay="250">That page does not exist. <a href="/">Go to the home page</a>.</p>
</section>`
}));

// feeds
const xml = (s) => esc(s);
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${xml(site.name)}</title>
<link>${SITE_URL}/blog/</link>
<description>${xml(`Posts and links from ${site.name}.`)}</description>
${posts.map((p) => `<item><title>${xml(p.title)}</title><link>${xml(p.link || `${SITE_URL}/blog/${p.slug}/`)}</link><guid>${xml(p.link || `${SITE_URL}/blog/${p.slug}/`)}</guid><pubDate>${new Date(p.date + 'T00:00:00Z').toUTCString()}</pubDate><description>${xml(p.summary)}</description></item>`).join('\n')}
</channel></rss>
`);
const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod></url>
<url><loc>${SITE_URL}/ovat/</loc><lastmod>${today}</lastmod></url>
<url><loc>${SITE_URL}/journey/</loc><lastmod>${today}</lastmod></url>
<url><loc>${SITE_URL}/blog/</loc><lastmod>${today}</lastmod></url>
${posts.filter((p) => !p.link).map((p) => `<url><loc>${SITE_URL}/blog/${p.slug}/</loc><lastmod>${p.date}</lastmod></url>`).join('\n')}
</urlset>
`);

// data for terminal mode
const data = {
  site: { name: site.name, role: site.role, location: site.location, status: site.status, links: site.links, emailParts: site.emailParts, education: site.education, skills: site.skills },
  projects: projects.map((p) => ({ id: p.id, name: p.name, sprite: p.sprite || '', flagship: !!p.flagship, context: p.context || '', tagline: p.tagline, description: p.description, facts: p.facts || [], stack: p.stack, links: p.links })),
  opensource,
  journey,
  posts: posts.map((p) => ({ title: p.title, date: niceDate(p.date), tag: p.link ? platform(p.link) : 'Post', url: p.link || `${SITE_URL}/blog/${p.slug}/` }))
};
write('assets/data.js', `window.SITE = ${JSON.stringify(data).replace(/</g, '\\u003c')};\n`);

console.log(`Built _site: home, ovat, journey, blog (${posts.length} entries, ${posts.filter((p) => !p.link).length} pages), feed, sitemap.`);
