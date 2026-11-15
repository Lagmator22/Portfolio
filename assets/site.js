/* ============================================================
 * gurman.is-a.dev: behaviour for every page.
 * Sections: sprites · entrance and scroll reveals · OVAT block
 * (terminal, counters, charts) · journey timeline · header ·
 * theme · email · old links · terminal mode.
 * Nothing here uses innerHTML: all output is built with
 * createElement / textContent.
 * ============================================================ */
(function () {
  'use strict';
  var root = document.documentElement;
  var DATA = window.SITE || null;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ============================================================
   * Sprites
   * Each sprite is 16 rows of 8 characters: the left half of a
   * 16x16 grid, mirrored at draw time. Characters index into the
   * sprite's palette; "." is empty. `blink` lists the rows that
   * change while the eyes are closed.
   * To add one: add an entry here and set "sprite" on the project
   * in content/projects.json.
   * ============================================================ */
  var SPRITES = {
    ovat: {
      pal: { o: '#1b2a4e', b: '#5b8def', s: '#3e6bc4', h: '#a9c6ff', a: '#7cf5c4', d: '#16223f' },
      rows: ['.......a', '.......o', '..oooooo', '.obhhbbb', '.obbbbbb', 'oobddddd', 'oobdaadd', 'oobdaadd',
             '.obddddd', '.osbbbbb', '..oooooo', '.oobbbbb', 'obobhbbb', 'oo.obbbb', '...ossss', '...ooo.o'],
      blink: { 6: 'oobddddd' }
    },
    ovasearch: {
      pal: { o: '#2a1b52', b: '#8e6be8', s: '#6a49c2', h: '#c4b0fa', a: '#ffb23e', w: '#ffffff', p: '#1c1233' },
      rows: ['........', '.oo.....', '.obooooo', '.obbbbbb', '.oooooob', '.owwwwob', '.owppwoa', '.owppwoa',
             '.owwwwob', '.oooooob', '.obbhbhb', '.obhbhbh', '.osbhbhb', '..osssss', '...ooooo', '....aa..'],
      blink: { 5: '.ohhhhob', 6: '.ohhhhoa', 7: '.ooooooa', 8: '.ohhhhob' }
    },
    lisper: {
      pal: { o: '#0e3b36', b: '#2fbfa5', s: '#1e9482', h: '#8de8d4', a: '#ff8fa3', w: '#ffffff', p: '#0b2b27' },
      rows: ['..oo....', '.obbo...', '.obao...', '.obao...', '.obao...', '.obboooo', '.obhbbbb', '.obbbbbb',
             '.obwwbbb', '.obwpbbb', '.obbbbba', '.oabbbbo', '.obbbbbb', '..osbbbb', '...ossss', '....oooo'],
      blink: { 8: '.obbbbbb', 9: '.oboobbb' }
    },
    parable: {
      pal: { o: '#2b3048', b: '#e9ecf5', s: '#b9c0d9', h: '#ffffff', w: '#2b3048' },
      rows: ['........', '.....ooo', '...oohhb', '..ohhbbb', '..ohbbbb', '.ohbbbbb', '.obbwwbb', '.obbwwbb',
             '.obbwwbb', '.obbbbbb', '.obbbbbo', '.obbbbbb', '.osbbbbb', '.ossbbsb', '.osossos', '..o.oo.o'],
      blink: { 6: '.obbbbbb', 7: '.obbbbbb', 8: '.obboobb' }
    },
    sutra: {
      pal: { o: '#173d17', b: '#6ccb5f', s: '#46a03c', h: '#b4ebaa', a: '#ffc93c', A: '#e09e12', w: '#ffffff', p: '#0f2a0f' },
      rows: ['........', '.....ooo', '...ooaaa', '..oahaaa', '..oaaaaa', 'oAAAAAAA', '.ooooooo', '.obhbbbb',
             '.obwwbbb', '.obwpbbb', '.obbbbob', 'obbbbbbo', 'obbbbbbb', 'osbbbbbb', 'osssssss', '.ooooooo'],
      blink: { 8: '.obbbbbb', 9: '.oboobbb' }
    },
    vaultagent: {
      pal: { o: '#3a160b', b: '#c9643b', s: '#9b4526', h: '#e89468', a: '#f2c94c', A: '#c99a1e', d: '#1e0b06', w: '#ffffff' },
      rows: ['........', '..oooooo', '.obhhbbb', '.obbbbbb', '.oabbbba', '.oabbbba', '.ooooooo', '.oddwwdd',
             '.odddddd', '.owdwdwd', '.ooooooo', '.oabbbba', '.oabbbbA', '.oabbbba', '.oasssss', '.ooooooo'],
      blink: { 7: '.odddddd' }
    }
  };

  function mirror(row) { return row + row.split('').reverse().join(''); }

  function Sprite(canvas) {
    var def = SPRITES[canvas.dataset.sprite];
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pal = def.pal;
    this.open = def.rows.map(mirror);
    this.shut = def.rows.map(function (r, i) { return mirror(def.blink[i] || r); });
    this.delay = Number(canvas.dataset.delay || 0);
    this.built = false;
    this.visible = false;
    this.blinkTimer = 0;
    canvas._sprite = this;
    canvas.style.setProperty('--phase', (-Math.random() * 1.3).toFixed(2) + 's');
  }

  /* Draw `rows`; when `order` is given, only its first `count` pixels. */
  Sprite.prototype.draw = function (rows, order, count) {
    var ctx = this.ctx, x, y, c, i;
    ctx.clearRect(0, 0, 16, 16);
    if (order) {
      for (i = 0; i < count; i++) {
        x = order[i] & 15; y = order[i] >> 4;
        ctx.fillStyle = this.pal[rows[y][x]];
        ctx.fillRect(x, y, 1, 1);
      }
      return;
    }
    for (y = 0; y < 16; y++) {
      for (x = 0; x < 16; x++) {
        c = rows[y][x];
        if (c !== '.') { ctx.fillStyle = this.pal[c]; ctx.fillRect(x, y, 1, 1); }
      }
    }
  };

  /* Pixels land from the ground up, with some scatter, over ~0.7s. */
  Sprite.prototype.build = function () {
    if (this.built) return;
    this.built = true;
    var self = this, rows = this.open, order = [], x, y;
    for (y = 0; y < 16; y++) {
      for (x = 0; x < 16; x++) {
        if (rows[y][x] !== '.') order.push({ k: y * 16 + x, w: (15 - y) + Math.random() * 7 });
      }
    }
    order.sort(function (a, b) { return a.w - b.w; });
    order = order.map(function (p) { return p.k; });
    if (reduceMotion) { this.draw(rows); return; }
    var start = 0, duration = 700;
    function frame(now) {
      if (!start) start = now;
      var t = Math.min(1, (now - start) / duration);
      self.draw(rows, order, Math.round(t * order.length));
      if (t < 1) requestAnimationFrame(frame);
      else self.scheduleBlink();
    }
    setTimeout(function () { requestAnimationFrame(frame); }, this.delay);
  };

  Sprite.prototype.scheduleBlink = function () {
    var self = this;
    clearTimeout(this.blinkTimer);
    if (reduceMotion || !this.visible) return;
    this.blinkTimer = setTimeout(function () {
      self.draw(self.shut);
      setTimeout(function () { self.draw(self.open); self.scheduleBlink(); }, 140);
    }, 2200 + Math.random() * 4200);
  };

  Sprite.prototype.hop = function () {
    var c = this.canvas;
    c.classList.remove('is-hop');
    void c.offsetWidth;
    c.classList.add('is-hop');
    setTimeout(function () { c.classList.remove('is-hop'); }, 600);
  };

  var spriteWatch = hasIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var s = entry.target._sprite;
      s.visible = entry.isIntersecting;
      if (entry.isIntersecting) { if (!s.built) s.build(); else s.scheduleBlink(); }
      else clearTimeout(s.blinkTimer);
    });
  }, { threshold: 0.35 }) : null;

  var sprites = $$('canvas[data-sprite]').filter(function (c) { return SPRITES[c.dataset.sprite]; })
    .map(function (c) { return new Sprite(c); });

  /* ============================================================
   * Small effects, each started when its element scrolls in.
   * ============================================================ */

  /* Count a number up from zero. */
  function countUp(node) {
    var target = parseFloat(node.dataset.count);
    var decimals = Number(node.dataset.decimals || 0);
    var prefix = node.dataset.prefix || '', suffix = node.dataset.suffix || '';
    var fmt = function (v) { return prefix + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix; };
    if (reduceMotion) { node.textContent = fmt(target); return; }
    var start = 0, duration = 1300;
    function frame(now) {
      if (!start) start = now;
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 4);
      node.textContent = fmt(decimals ? target * eased : Math.round(target * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    node.textContent = fmt(0);
    requestAnimationFrame(frame);
  }

  /* Resolve a line of monospace text out of noise, left to right. */
  function decode(node) {
    var text = node.textContent, glyphs = '01<>/_-=+*#', start = 0, duration = 700;
    if (reduceMotion || !text) return;
    function frame(now) {
      if (!start) start = now;
      var done = Math.floor(((now - start) / duration) * text.length), out = '', i, ch;
      for (i = 0; i < text.length; i++) {
        ch = text[i];
        out += i < done || ch === ' ' ? ch : glyphs[(Math.random() * glyphs.length) | 0];
      }
      node.textContent = out;
      if (done < text.length) requestAnimationFrame(frame); else node.textContent = text;
    }
    requestAnimationFrame(frame);
  }

  /* Type the quickstart commands, one line at a time. */
  function typeTerminal(pre) {
    var lines = pre.textContent.split('\n').filter(Boolean);
    pre.style.minHeight = pre.offsetHeight + 'px';
    pre.textContent = '';
    var caret = el('span', 'caret');
    function addLine(line, typed) {
      var hash = line.search(/\s{2,}#/);
      var cmd = hash > -1 ? line.slice(0, hash) : line;
      var comment = hash > -1 ? line.slice(hash) : '';
      var body = cmd.replace(/^\$\s?/, '');
      var row = el('span');
      row.appendChild(el('span', 't-p', '$ '));
      var text = el('span', null, typed ? '' : body);
      row.appendChild(text);
      pre.insertBefore(row, caret.parentNode === pre ? caret : null);
      return { text: text, body: body, comment: comment, row: row };
    }
    if (reduceMotion) {
      lines.forEach(function (line, i) {
        var l = addLine(line, false);
        if (l.comment) l.row.appendChild(el('span', 't-c', l.comment));
        if (i < lines.length - 1) pre.appendChild(document.createTextNode('\n'));
      });
      return;
    }
    pre.appendChild(caret);
    var li = 0;
    function nextLine() {
      if (li >= lines.length) return;
      var l = addLine(lines[li], true), ci = 0;
      function tick() {
        if (ci < l.body.length) {
          l.text.textContent += l.body[ci++];
          setTimeout(tick, 14 + Math.random() * 26);
        } else {
          if (l.comment) l.row.appendChild(el('span', 't-c', l.comment));
          li++;
          if (li < lines.length) { pre.insertBefore(document.createTextNode('\n'), caret); setTimeout(nextLine, 280); }
        }
      }
      tick();
    }
    setTimeout(nextLine, 350);
  }

  /* Chart setup that does not depend on scroll. */
  $$('.bar[data-v]').forEach(function (bar) { bar.style.setProperty('--v', bar.dataset.v); });
  $$('[data-cells]').forEach(function (grid) {
    var total = Number(grid.dataset.cells), base = Number(grid.dataset.base), gain = Number(grid.dataset.gain), i, cell;
    for (i = 0; i < total; i++) {
      cell = el('i', i < base ? 'c1' : i < base + gain ? 'c2' : '');
      cell.style.setProperty('--n', i < base ? i * 0.4 : 30 + (i - base) * 5);
      grid.appendChild(cell);
    }
  });

  function activate(node) {
    function each(sel, fn) {
      if (node.matches(sel)) fn(node);
      $$(sel, node).forEach(fn);
    }
    each('[data-count]', countUp);
    each('[data-decode]', decode);
    each('[data-term]', typeTerminal);
  }

  /* ============================================================
   * Entrance: split titles into words, then start once the web
   * font is in (or after a short wait) so nothing animates in the
   * fallback face.
   * ============================================================ */
  $$('[data-words]').forEach(function (title) {
    var words = title.textContent.trim().split(/\s+/);
    title.textContent = '';
    words.forEach(function (word, i) {
      var box = el('span', 'word'), inner = el('span', null, word);
      box.style.setProperty('--i', i);
      box.appendChild(inner);
      title.appendChild(box);
      if (i < words.length - 1) title.appendChild(document.createTextNode(' '));
    });
  });

  $$('[data-reveal][data-delay]').forEach(function (node) {
    node.style.setProperty('--d', Number(node.dataset.delay) / 1000 + 's');
  });

  var revealWatch = hasIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var node = entry.target;
      revealWatch.unobserve(node);
      node.classList.add('is-in');
      setTimeout(function () { activate(node); }, Number(node.dataset.delay || 0));
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;

  function start() {
    if (root.classList.contains('is-ready')) return;
    root.classList.add('is-ready');
    $$('[data-reveal]').forEach(function (node) {
      if (revealWatch) revealWatch.observe(node); else { node.classList.add('is-in'); activate(node); }
    });
    sprites.forEach(function (s) {
      if (spriteWatch && !s.canvas.hasAttribute('data-walker')) spriteWatch.observe(s.canvas);
      else { s.visible = true; s.build(); }
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  setTimeout(start, 500);

  /* Plain numbers in a project's facts count up when the project scrolls in
     ("6 ms", "30", "4.8 s"). Anything else ("525/525") is left as written. */
  $$('.facts dt').forEach(function (dt) {
    var m = dt.textContent.trim().match(/^(~)?(\d[\d,]*(?:\.\d+)?)(\s?[A-Za-z%]+)?$/);
    if (!m) return;
    dt.dataset.count = m[2].replace(/,/g, '');
    dt.dataset.decimals = (m[2].split('.')[1] || '').length;
    if (m[1]) dt.dataset.prefix = m[1];
    if (m[3]) dt.dataset.suffix = m[3];
  });

  /* Once the cast has assembled, the sprites hop one after another, once. */
  var cast = $$('.lineup canvas[data-sprite]');
  if (cast.length && !reduceMotion) {
    setTimeout(function () {
      cast.forEach(function (c, i) { setTimeout(function () { if (c._sprite) c._sprite.hop(); }, i * 110); });
    }, 3000);
  }

  /* The hero drifts and dims a little as it scrolls away. */
  var hero = $('.hero');
  if (hero && !reduceMotion) {
    var heroTick = false;
    var driftHero = function () {
      heroTick = false;
      var p = Math.max(0, Math.min(1, window.scrollY / Math.max(1, hero.offsetHeight)));
      hero.style.setProperty('--hp', p.toFixed(3));
    };
    window.addEventListener('scroll', function () {
      if (!heroTick) { heroTick = true; requestAnimationFrame(driftHero); }
    }, { passive: true });
    driftHero();
  }

  /* ============================================================
   * Journey: entries light up as the page scrolls past them, the
   * line fills behind them, and the chips filter by kind.
   * ============================================================ */
  var journey = $('[data-journey]');
  if (journey) {
    var entries = $$('li', journey);
    var chips = $$('.chip[data-filter]');
    var journeyWatch = hasIO ? new IntersectionObserver(function (list) {
      list.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-on'); journeyWatch.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -18% 0px' }) : null;
    entries.forEach(function (li) { if (journeyWatch) journeyWatch.observe(li); else li.classList.add('is-on'); });

    var fillJourney = function () {
      var r = journey.getBoundingClientRect();
      var p = (window.innerHeight * 0.7 - r.top) / Math.max(1, r.height);
      journey.style.setProperty('--fill', Math.max(0, Math.min(1, p)).toFixed(4));
    };
    window.addEventListener('scroll', fillJourney, { passive: true });
    window.addEventListener('resize', fillJourney);
    fillJourney();

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var kind = chip.dataset.filter, shown = 0;
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        entries.forEach(function (li) {
          var match = kind === 'all' || li.dataset.kind === kind;
          li.hidden = !match;
          li.classList.remove('is-on');
          if (match) li.style.setProperty('--n', shown++);
        });
        void journey.offsetWidth;
        entries.forEach(function (li) { if (!li.hidden) li.classList.add('is-on'); });
        fillJourney();
      });
    });
  }

  /* ============================================================
   * Header: reading progress along the bottom edge, with a robot
   * walking on it, and the current section marked in the nav.
   * ============================================================ */
  var head = $('.site-head'), walker = $('[data-walker]');
  var walkTimer = 0;
  function measureTrack() { head.style.setProperty('--track-w', head.clientWidth + 'px'); }
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    head.classList.toggle('is-scrolled', window.scrollY > 8);
    head.style.setProperty('--p', p.toFixed(4));
    if (walker && !reduceMotion) {
      walker.classList.add('is-walking');
      clearTimeout(walkTimer);
      walkTimer = setTimeout(function () { walker.classList.remove('is-walking'); }, 160);
    }
  }
  if (head) {
    measureTrack();
    window.addEventListener('resize', measureTrack);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (walker) walker.classList.remove('is-walking');
  }

  var navLinks = $$('.site-nav a');
  var sections = $$('main [id]').filter(function (s) {
    return navLinks.some(function (a) { return a.getAttribute('href').split('#')[1] === s.id; });
  });
  if (hasIO && sections.length) {
    var sectionWatch = new IntersectionObserver(function (list) {
      list.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          var id = a.getAttribute('href').split('#')[1];
          if (!id) return;
          if (id === entry.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { sectionWatch.observe(s); });
  }

  /* ============================================================
   * Theme: follows the system until the button is used, then
   * remembers the choice. The two themes cross-fade.
   * ============================================================ */
  var themeBtn = $('.theme-btn');
  function isDark() {
    var set = root.getAttribute('data-theme');
    return set ? set === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function labelTheme() { if (themeBtn) themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); }
  function setTheme(next) {
    function apply() {
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      labelTheme();
    }
    if (reduceMotion) { apply(); return; }
    /* A slow cross-fade between the two themes. */
    if (document.startViewTransition) {
      root.classList.add('theming');
      var vt = document.startViewTransition(apply);
      var end = function () { root.classList.remove('theming'); };
      vt.finished.then(end, end);
    } else {
      root.classList.add('theming-css');
      apply();
      setTimeout(function () { root.classList.remove('theming-css'); }, 750);
    }
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
    labelTheme();
  }

  /* ============================================================
   * Email: the address is assembled here so it never appears in
   * the page source. Clicking opens the mail app and also copies
   * the address, for people on webmail.
   * ============================================================ */
  var address = DATA ? DATA.site.emailParts.join('') : '';
  var emailStatus = $('[data-email-status]');
  var statusText = emailStatus ? emailStatus.textContent : '', statusTimer = 0;
  function copyAddress(done) {
    if (!navigator.clipboard || !address) return;
    navigator.clipboard.writeText(address).then(done, function () {});
  }
  if (address) {
    $$('[data-email]').forEach(function (a) {
      a.href = 'mailto:' + address;
      a.addEventListener('click', function () {
        copyAddress(function () {
          if (!emailStatus) return;
          emailStatus.textContent = 'Address copied: ' + address;
          clearTimeout(statusTimer);
          statusTimer = setTimeout(function () { emailStatus.textContent = statusText; }, 4000);
        });
      });
    });
  }

  /* ============================================================
   * Old links: hash routes from the previous site (#/projects/ovat,
   * #/about, #/blog ...) still land somewhere sensible, and arriving
   * at a project makes its sprite hop.
   * ============================================================ */
  function resolveHash() {
    var hash = location.hash;
    if (hash.indexOf('#/') === 0 && $('#work')) {
      var parts = hash.slice(2).split('/').filter(Boolean);
      if (parts[0] === 'blog' || parts[0] === 'post') { location.replace('blog/'); return; }
      var target = 'top';
      if (parts[0] === 'projects') target = parts[1] && document.getElementById(parts[1]) ? parts[1] : 'work';
      else if (parts[0] === 'about' || parts[0] === 'contact') target = parts[0];
      history.replaceState(null, '', target === 'top' ? location.pathname : '#' + target);
      var node = document.getElementById(target);
      if (node) node.scrollIntoView();
      hash = '#' + target;
    }
    if (hash === '#terminal') { openTui(); return; }
    var project = /^#[a-z0-9-]+$/.test(hash) && document.getElementById(hash.slice(1));
    var canvas = project && $('canvas[data-sprite]', project);
    if (canvas && canvas._sprite) setTimeout(function () { canvas._sprite.hop(); }, 500);
  }

  /* ============================================================
   * Terminal mode: the same content as the page, as a shell.
   * Opened from the >_ button, the ` key, or #terminal.
   * ============================================================ */
  var tui = null;

  function buildTui() {
    var S = DATA.site;
    var box = el('div', 'tui');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Terminal mode');
    box.hidden = true;

    var bar = el('div', 'tui__bar');
    bar.appendChild(el('span', 'tui__name', 'gurman@is-a.dev: ~'));
    var close = el('button', 'tui__close', 'exit [esc]');
    close.type = 'button';
    bar.appendChild(close);

    var screen = el('div', 'tui__screen');
    var out = el('div', 'tui__out');
    out.setAttribute('aria-live', 'polite');
    var form = el('form', 'tui__line');
    var prompt = el('label', 'tui__prompt', 'gurman:~$');
    prompt.htmlFor = 'tui-input';
    var input = el('input', 'tui__input');
    input.id = 'tui-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', 'Command');
    form.appendChild(prompt);
    form.appendChild(input);
    screen.appendChild(out);
    screen.appendChild(form);

    var chipBar = el('div', 'tui__chips');
    ['help', 'about', 'ovat', 'projects', 'journey', 'oss', 'skills', 'posts', 'contact', 'clear', 'exit'].forEach(function (c) {
      var b = el('button', null, c);
      b.type = 'button';
      b.addEventListener('click', function () { run(c); input.focus(); });
      chipBar.appendChild(b);
    });

    box.appendChild(bar);
    box.appendChild(screen);
    box.appendChild(chipBar);
    document.body.appendChild(box);

    /* ---- output helpers ---- */
    var queue = 0;
    function put(node) {
      node.classList.add('tui__ln');
      node.style.setProperty('--n', Math.min(queue++, 40));
      out.appendChild(node);
      return node;
    }
    function line(text, cls) { return put(el('div', cls || null, text == null ? '' : text)); }
    function gap() { return line(' '); }
    function head(text) { return line(text, 't-h'); }
    function dim(text) { return line(text, 't-d'); }
    function pair(key, value) {
      var row = el('div', 't-kv');
      row.appendChild(el('span', 't-k', key));
      row.appendChild(el('span', null, value));
      return put(row);
    }
    function linkRow(label, url) {
      var row = el('div', 't-kv');
      row.appendChild(el('span', 't-k', label));
      var a = el('a', null, url.replace(/^https?:\/\//, '').replace(/^mailto:/, ''));
      a.href = url;
      if (/^https?:/.test(url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      row.appendChild(a);
      return put(row);
    }
    function hint(text) { gap(); dim(text); }
    function spriteRow(keys) {
      var row = el('div', 'tui__sprites');
      keys.forEach(function (k) {
        if (!SPRITES[k]) return;
        var c = el('canvas', 'sprite');
        c.width = 16; c.height = 16;
        c.dataset.sprite = k;
        c.setAttribute('aria-hidden', 'true');
        row.appendChild(c);
        var s = new Sprite(c);
        s.visible = true;
        s.build();
      });
      return put(row);
    }
    function findProject(name) {
      name = (name || '').toLowerCase();
      return DATA.projects.filter(function (p) { return p.id === name || p.name.toLowerCase() === name; })[0];
    }
    function showProject(p) {
      if (p.sprite) spriteRow([p.sprite]);
      head(p.name + (p.context ? '  ·  ' + p.context : ''));
      line(p.tagline);
      gap();
      line(p.description, 't-d');
      if (p.facts.length) { gap(); p.facts.forEach(function (f) { pair(f.value, f.label); }); }
      gap();
      pair('stack', p.stack);
      p.links.forEach(function (l) { linkRow(l.label.toLowerCase(), l.url); });
    }
    function showJourney(kinds, title) {
      head(title);
      DATA.journey.filter(function (j) { return !kinds || kinds.indexOf(j.kind) > -1; }).forEach(function (j) {
        gap();
        pair(j.when, j.title);
        dim('  ' + j.detail);
      });
    }

    /* ---- commands ---- */
    var commands = {
      help: ['list every command', function () {
        head('Commands');
        Object.keys(commands).forEach(function (name) { if (commands[name][0]) pair(name, commands[name][0]); });
        hint('Tab completes. Up and Down recall earlier commands. Tap the chips below on a phone.');
      }],
      about: ['who I am, in ten lines', function () {
        spriteRow(['ovat']);
        head(S.name);
        line(S.role + '.');
        gap();
        pair('now', 'GSoC 2026 contributor at Intel OpenVINO. Built and shipped OVAT.');
        pair('status', S.status);
        pair('based', S.location);
        pair('school', S.education.degree + ', ' + S.education.school + ' (' + S.education.when + ')');
        pair('focus', 'C++, local inference, agents, retrieval');
        hint('Next: ovat · projects · journey · contact');
      }],
      ovat: ['my flagship project', function () { showProject(findProject('ovat')); hint('Try it: pip install ovat'); }],
      projects: ['everything I have built', function () {
        head('Projects');
        DATA.projects.forEach(function (p) { pair(p.id, p.tagline); });
        hint('Details: project <name>   Open in a tab: open <name>');
      }],
      project: ['details for one project: project ovasearch', function (args) {
        var p = findProject(args[0]);
        if (!p) { line('No project called "' + (args[0] || '') + '". Run projects to list them.', 't-e'); return; }
        showProject(p);
      }],
      open: ['open a project or profile in a new tab: open ovat', function (args) {
        var key = (args[0] || '').toLowerCase(), url = '';
        var p = findProject(key);
        if (p && p.links.length) url = p.links[0].url;
        S.links.forEach(function (l) { if (l.label.toLowerCase() === key) url = l.url; });
        if (key === 'blog' || key === 'posts' || key === 'journey') url = new URL(key === 'journey' ? 'journey/' : 'blog/', $('.brand').href).href;
        if (key === 'ovat') url = new URL('ovat/', $('.brand').href).href;
        if (!url) { line('Nothing to open for "' + key + '". Try: open ovat, open github, open x.', 't-e'); return; }
        window.open(url, '_blank', 'noopener');
        line('Opened ' + url);
      }],
      journey: ['experience, open source, hackathons, honors', function () { showJourney(null, 'Journey'); }],
      experience: ['work experience only', function () { showJourney(['experience'], 'Experience'); }],
      honors: ['hackathons and honors only', function () { showJourney(['honor', 'hackathon'], 'Hackathons and honors'); }],
      oss: ['merged open source pull requests', function () {
        head('Merged upstream');
        DATA.opensource.forEach(function (o) {
          gap();
          linkRow(o.repo + ' #' + o.number, o.url);
          line('  ' + o.title);
          if (o.note) dim('  ' + o.note);
        });
      }],
      skills: ['languages, AI systems, tools', function () {
        head('Skills');
        S.skills.forEach(function (s) { gap(); line(s.label, 't-k'); line(s.value); });
      }],
      education: ['where I study', function () {
        head('Education');
        line(S.education.degree);
        line(S.education.school);
        dim(S.education.when);
      }],
      posts: ['writing and links', function () {
        head('Writing');
        if (!DATA.posts.length) { dim('Nothing here yet.'); return; }
        DATA.posts.forEach(function (p) { gap(); pair(p.date, p.title + '  [' + p.tag + ']'); linkRow('', p.url); });
      }],
      contact: ['how to reach me', function () {
        head('Contact');
        linkRow('email', 'mailto:' + address);
        S.links.forEach(function (l) { linkRow(l.label.toLowerCase(), l.url); });
        hint('email copies the address to your clipboard.');
      }],
      email: ['copy my email address', function () {
        line(address);
        copyAddress(function () { dim('Copied to clipboard.'); });
      }],
      sprites: ['the pixel cast', function () {
        spriteRow(DATA.projects.filter(function (p) { return p.sprite; }).map(function (p) { return p.sprite; }));
        dim(DATA.projects.filter(function (p) { return p.sprite; }).map(function (p) { return p.name; }).join('  ·  '));
      }],
      theme: ['switch light and dark: theme dark', function (args) {
        var next = args[0] === 'light' || args[0] === 'dark' ? args[0] : (isDark() ? 'light' : 'dark');
        setTheme(next);
        line('Site theme: ' + next + '.');
      }],
      clear: ['clear the screen', function () { out.textContent = ''; }],
      exit: ['go back to the site', function () { closeTui(); }],
      /* unlisted */
      whoami: ['', function () { commands.about[1]([]); }],
      ls: ['', function () { commands.projects[1]([]); }],
      cat: ['', function (args) { commands.project[1](args); }],
      blog: ['', function () { commands.posts[1]([]); }],
      social: ['', function () { commands.contact[1]([]); }],
      opensource: ['', function () { commands.oss[1]([]); }],
      hire: ['', function () { line('Good call.'); gap(); commands.contact[1]([]); }],
      sudo: ['', function () { line('Permission denied. This shell is read-only.', 't-e'); }],
      quit: ['', function () { closeTui(); }],
      gui: ['', function () { closeTui(); }]
    };

    function run(raw) {
      var text = raw.trim();
      queue = 0;
      var echo = el('div', 't-echo');
      echo.appendChild(el('span', 't-p', 'gurman:~$ '));
      echo.appendChild(el('span', null, text));
      put(echo);
      if (text) {
        var parts = text.split(/\s+/), name = parts[0].toLowerCase(), cmd = commands[name];
        if (cmd) cmd[1](parts.slice(1));
        else if (findProject(name)) showProject(findProject(name));
        else line('command not found: ' + name + '. Type help to see what works.', 't-e');
        history.push(text);
        cursor = history.length;
      }
      gap();
      screen.scrollTop = screen.scrollHeight;
    }

    /* ---- input: history and completion ---- */
    var history = [], cursor = 0;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = input.value;
      input.value = '';
      run(value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') {
        if (cursor > 0) cursor--;
        if (history[cursor] != null) input.value = history[cursor];
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (cursor < history.length) cursor++;
        input.value = history[cursor] || '';
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        var parts = input.value.split(/\s+/);
        var pool = parts.length < 2
          ? Object.keys(commands).filter(function (n) { return commands[n][0]; })
          : DATA.projects.map(function (p) { return p.id; }).concat(['github', 'linkedin', 'x', 'blog', 'light', 'dark']);
        var stem = parts[parts.length - 1].toLowerCase();
        var hits = pool.filter(function (n) { return n.indexOf(stem) === 0; });
        if (hits.length === 1) { parts[parts.length - 1] = hits[0]; input.value = parts.join(' ') + ' '; }
        else if (hits.length > 1) { queue = 0; dim(hits.join('   ')); screen.scrollTop = screen.scrollHeight; }
      }
    });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTui(); });
    close.addEventListener('click', closeTui);
    screen.addEventListener('click', function (e) { if (e.target === screen || e.target === out) input.focus(); });

    function greet() {
      queue = 0;
      spriteRow(DATA.projects.filter(function (p) { return p.sprite; }).map(function (p) { return p.sprite; }));
      head(S.name + '  ·  ' + S.role);
      gap();
      line('This is the same site, as a shell. Type a command and press Enter.');
      gap();
      pair('help', 'list every command');
      pair('about', 'who I am');
      pair('ovat', 'my flagship project');
      pair('projects', 'everything I have built');
      pair('journey', 'experience, hackathons, honors');
      pair('contact', 'how to reach me');
      pair('exit', 'back to the site (or press Esc)');
      gap();
      dim('Tab completes. Up and Down recall earlier commands.');
      gap();
    }

    return { box: box, input: input, greet: greet, greeted: false };
  }

  var lastFocus = null, closeTimer = 0;
  function openTui() {
    if (!DATA) return;
    if (!tui) tui = buildTui();
    clearTimeout(closeTimer);
    if (!tui.box.hidden && tui.box.classList.contains('is-open')) return;
    lastFocus = document.activeElement;
    tui.box.hidden = false;
    void tui.box.offsetWidth;                 // let the closed state paint, so the open one animates
    tui.box.classList.add('is-open');
    root.classList.add('tui-open');
    $$('body > header, body > main, body > footer').forEach(function (n) { n.inert = true; });
    if (!tui.greeted) { tui.greeted = true; tui.greet(); }
    tui.input.focus();
  }
  function closeTui() {
    if (!tui || tui.box.hidden || !tui.box.classList.contains('is-open')) return;
    tui.box.classList.remove('is-open');      // plays the opening animation in reverse
    root.classList.remove('tui-open');
    $$('body > header, body > main, body > footer').forEach(function (n) { n.inert = false; });
    if (location.hash === '#terminal') history.replaceState(null, '', location.pathname);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    closeTimer = setTimeout(function () { tui.box.hidden = true; }, reduceMotion ? 0 : 480);
  }
  $$('[data-tui-open]').forEach(function (b) { b.addEventListener('click', openTui); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '`' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    openTui();
  });

  window.addEventListener('hashchange', resolveHash);
  resolveHash();
})();
