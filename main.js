// now / prev toggle: the pill slides to the chosen tab and that list replays its reveal
(function () {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.toggle button'));
    var pill = document.querySelector('.toggle-pill');

    function movePill(btn) {
        pill.style.setProperty('--w', btn.offsetWidth + 'px');
        pill.style.setProperty('--x', (btn.offsetLeft - 3) + 'px');
    }

    buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            buttons.forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
            movePill(btn);
            document.querySelectorAll('.xps').forEach(function (panel) {
                var show = panel.dataset.panel === btn.dataset.tab;
                panel.hidden = !show;
                if (!show) return;
                panel.querySelectorAll('.rv').forEach(function (el, i) {
                    el.classList.remove('in');
                    void el.offsetWidth;
                    el.style.setProperty('--d', i * 70 + 'ms');
                    el.classList.add('in');
                });
            });
        });
    });

    movePill(buttons[0]);
    if (document.fonts) document.fonts.ready.then(function () { movePill(document.querySelector('.toggle [aria-selected="true"]')); });
})();

// Name animation. Letters rise in one after another, then react to the cursor:
// the letters nearest it thin out, lift and pick up the accent color, and ease back
// as it moves away. A single sweep runs after the intro so touch users see it too.
(function () {
    var name = document.querySelector('.name');
    var letters = Array.prototype.slice.call(name.querySelectorAll('.l'));
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    letters.forEach(function (el, i) { el.style.setProperty('--i', i); });
    if (reduced) {
        name.classList.add('ready');
        return;
    }
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { name.classList.add('ready'); });
    });

    var BASE = 800, MIN = 250, RADIUS = 110, EASE = 0.14;
    var state = letters.map(function () { return { f: 0 }; });
    var pointer = null, sweep = null, running = false;

    function centers() {
        return letters.map(function (el) {
            var r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
    }

    function frame(now) {
        var target = pointer;
        if (sweep) {
            var t = (now - sweep.t0) / sweep.ms;
            if (t >= 1) sweep = null;
            else target = { x: sweep.x0 + (sweep.x1 - sweep.x0) * t, y: sweep.y };
        }

        var pts = centers(), moving = false;
        letters.forEach(function (el, i) {
            var goal = 0;
            if (target) {
                var dx = pts[i].x - target.x, dy = (pts[i].y - target.y) * 1.4;
                goal = Math.exp(-(dx * dx + dy * dy) / (RADIUS * RADIUS));
            }
            var s = state[i];
            s.f += (goal - s.f) * EASE;
            if (Math.abs(goal - s.f) > 0.002) moving = true;
            else s.f = goal;
            el.style.fontVariationSettings = '"wght" ' + Math.round(BASE - (BASE - MIN) * s.f);
            el.style.transform = s.f > 0.001 ? 'translateY(' + (-0.08 * s.f).toFixed(3) + 'em)' : '';
            el.style.color = s.f > 0.001 ? 'color-mix(in srgb, var(--court) ' + Math.round(s.f * 100) + '%, var(--ink))' : '';
        });

        if (moving || sweep || pointer) requestAnimationFrame(frame);
        else running = false;
    }

    function start() {
        if (running) return;
        running = true;
        requestAnimationFrame(frame);
    }

    var hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', function (e) {
        pointer = { x: e.clientX, y: e.clientY };
        start();
    });
    hero.addEventListener('pointerleave', function () {
        pointer = null;
        start();
    });

    // Once the intro has landed, hand the letters to JS and run one sweep
    var introMs = 900 + letters.length * 45;
    setTimeout(function () {
        name.classList.add('live');
        var r = name.getBoundingClientRect();
        sweep = { t0: performance.now(), ms: 1600, x0: r.left - RADIUS, x1: r.right + RADIUS, y: r.top + r.height / 2 };
        start();
    }, introMs);
})();

// Slow text reveals across the page. Section headings type themselves out, the intro
// resolves word by word, and everything else fades up out of a blur as it scrolls in.
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    // Intro, word by word, starting once the name has landed
    var intro = document.querySelector('.intro');
    // Split text into word spans but keep inline elements (like the Columbia pill) whole
    var n = 0, frag = document.createDocumentFragment();
    function wordSpan(child) {
        var s = document.createElement('span');
        s.className = 'w';
        s.style.setProperty('--d', (700 + n++ * 55) + 'ms');
        s.appendChild(child);
        return s;
    }
    Array.prototype.slice.call(intro.childNodes).forEach(function (node) {
        if (node.nodeType !== 3) { frag.appendChild(wordSpan(node)); return; }
        node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
            else frag.appendChild(wordSpan(document.createTextNode(part)));
        });
    });
    intro.textContent = '';
    intro.appendChild(frag);
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { intro.classList.add('in'); });
    });

    // Headings: typewriter with a caret that leaves when it's done
    var headings = Array.prototype.slice.call(document.querySelectorAll('.block h2'));
    headings.forEach(function (h) {
        h.dataset.text = h.textContent;
        h.setAttribute('aria-label', h.textContent);
        h.textContent = '';
        h.style.minHeight = '1.2em';
    });

    function type(h) {
        var text = h.dataset.text, i = 0;
        h.classList.add('typing');
        (function step() {
            i++;
            h.textContent = text.slice(0, i);
            if (i < text.length) setTimeout(step, 70 + Math.random() * 60);
            else setTimeout(function () { h.classList.remove('typing'); }, 900);
        })();
    }

    // Everything else
    var groups = [
        '.site-preview', '.g-card', '.xps:not([hidden]) .xp', '.xps[hidden] .xp', '.work li',
        '.li-sync', '.tweet', '.email-big', '.bullets li', '.market', '.contact', '.links', '.foot'
    ];
    var items = [];
    groups.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el, i) {
            el.classList.add('rv');
            el.style.setProperty('--d', (sel === '.site-preview' ? 1400 : i * 90) + 'ms');
            items.push(el);
        });
    });

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            io.unobserve(e.target);
            if (e.target.tagName === 'H2') type(e.target);
            else e.target.classList.add('in');
        });
    }, { rootMargin: '0px 0px -10% 0px' });

    headings.concat(items).forEach(function (el) { io.observe(el); });

    // Hidden "prev" items never intersect; mark them so the toggle can replay them
    document.querySelectorAll('.xps[hidden] .xp').forEach(function (el) { el.classList.add('in'); });
})();

// Recap gallery arrows scroll one card at a time, and hide when every card fits
(function () {
    var strip = document.querySelector('.gallery');
    var nav = document.querySelector('.g-nav');
    function fit() { nav.hidden = strip.scrollWidth <= strip.clientWidth + 1; }
    fit();
    window.addEventListener('resize', fit);
    document.querySelectorAll('.g-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var card = strip.querySelector('.g-card');
            strip.scrollBy({ left: Number(btn.dataset.dir) * (card.offsetWidth + 18), behavior: 'smooth' });
        });
    });
})();
