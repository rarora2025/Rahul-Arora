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
        '.li-sync', '.tweet', '.email-card', '.bullets li', '.market', '.contact', '.links', '.foot'
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

// Play-money prediction market, run entirely by the visitor. An LMSR market maker prices
// long (Yes) and short (No). Each visitor starts with a fresh market at 94% and $0 volume,
// moves it with their own trades, and it's saved in their browser.
(function () {
    var root = document.getElementById('pm');
    if (!root) return;

    var B = 250, START = 0.94, KEY = 'pm-rahul-v3', MAXPTS = 120;
    function price(q) { var a = Math.exp(q.y / B), c = Math.exp(q.n / B); return a / (a + c); }

    // Shares bought by spending x on a side: cost(q') - cost(q) = x
    function apply(qs, side, x) {
        var a = (side === 'yes' ? qs.y : qs.n) / B, c = (side === 'yes' ? qs.n : qs.y) / B;
        var m = Math.max(a, c), ea = Math.exp(a - m), ec = Math.exp(c - m);
        var d = B * (Math.log(Math.exp(x / B) * (ea + ec) - ec) - (a - m));
        var out = { y: qs.y, n: qs.n };
        out[side === 'yes' ? 'y' : 'n'] += d;
        return out;
    }

    var st = null;
    try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!st || !st.hist || !st.hist.length) {
        st = { q: { y: B * Math.log(START / (1 - START)), n: 0 }, vol: 0, hist: [{ t: Date.now(), p: START }] };
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

    var $ = function (sel) { return root.querySelector(sel); };
    var line = $('[data-line]'), area = $('[data-area]'), plot = $('[data-plot]');
    var cross = $('[data-cross]'), dot = $('[data-dot]'), tip = $('[data-tip]');
    var slider = $('[data-amt]'), amtOut = $('[data-amt-out]'), pctEl = $('[data-pct]');

    function cents(v) { return Math.round(v * 100) + '¢'; }
    function pct(v) { return Math.round(v * 100) + '%'; }
    function ago(t) {
        var s = (Date.now() - t) / 1000;
        if (s < 60) return 'just now';
        if (s < 3600) return Math.round(s / 60) + 'm ago';
        if (s < 86400) return Math.round(s / 3600) + 'h ago';
        return Math.round(s / 86400) + 'd ago';
    }

    // Chart: a step for each trade, the last one running to "now". A fresh market is a flat line.
    var pts = [];
    function draw() {
        var ps = st.hist.map(function (h) { return h.p; }), n = ps.length;
        var lo = Math.min.apply(null, ps) - 0.03, hi = Math.max.apply(null, ps) + 0.03;
        pts = ps.map(function (v, i) { return [(i / n) * 300, 70 - ((v - lo) / (hi - lo)) * 66]; });
        var d = 'M0 ' + pts[0][1].toFixed(1);
        for (var i = 1; i < n; i++) d += ' H' + pts[i][0].toFixed(1) + ' V' + pts[i][1].toFixed(1);
        d += ' H300';
        line.setAttribute('d', d);
        area.setAttribute('d', d + ' V72 H0 Z');
        $('[data-since]').textContent = n > 1 ? ago(st.hist[0].t) : 'start';
    }

    function render() {
        var py = price(st.q);
        pctEl.textContent = pct(py);
        $('[data-yes]').textContent = cents(py);
        $('[data-no]').textContent = cents(1 - py);
        var ch = (py - START) * 100, chEl = $('[data-change]');
        chEl.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%';
        chEl.classList.toggle('up', ch >= 0);
        chEl.classList.toggle('down', ch < 0);
        $('[data-vol]').textContent = '$' + Math.round(st.vol).toLocaleString('en-US');
        draw();
    }

    function amount() { return Number(slider.value) || 0; }
    function syncSlider() {
        amtOut.textContent = '$' + amount();
        slider.style.setProperty('--fill', ((amount() - slider.min) / (slider.max - slider.min) * 100) + '%');
    }
    slider.addEventListener('input', syncSlider);

    // Floating price change that rises off the end of the line
    function float(before, after) {
        root.querySelectorAll('.pm-float').forEach(function (old) { old.remove(); });
        var el = document.createElement('span'), diff = (after - before) * 100;
        el.className = 'pm-float ' + (diff >= 0 ? 'up' : 'down');
        el.textContent = (diff >= 0 ? '+ ' : '− ') + Math.abs(diff).toFixed(1) + '% → ' + pct(after);
        el.style.top = (pts[pts.length - 1][1] / 72 * plot.clientHeight) + 'px';
        plot.appendChild(el);
        el.addEventListener('animationend', function () { el.remove(); });
        pctEl.classList.remove('bump');
        void pctEl.offsetWidth;
        pctEl.classList.add('bump');
    }

    root.querySelectorAll('.m-row button').forEach(function (b) {
        b.addEventListener('click', function () {
            var x = amount(), before = price(st.q);
            if (!x) return;
            st.q = apply(st.q, b.dataset.side, x);
            st.vol += x;
            st.hist.push({ t: Date.now(), p: price(st.q), s: b.dataset.side, a: x });
            if (st.hist.length > MAXPTS) st.hist.splice(1, 1);
            save();
            render();
            float(before, price(st.q));
        });
    });

    // Hover (or drag on touch) to read the price at any point
    function hover(i) {
        var h = st.hist[i], n = st.hist.length, mid = (i + 0.5) / n * 300, w = plot.clientWidth, x = mid / 300 * w, pt = [mid, pts[i][1]];
        cross.setAttribute('x1', mid); cross.setAttribute('x2', mid); cross.removeAttribute('hidden');
        dot.hidden = tip.hidden = false;
        dot.style.left = x + 'px'; dot.style.top = (pt[1] / 72 * plot.clientHeight) + 'px';
        tip.textContent = '';
        var top = document.createElement('div'), b = document.createElement('b');
        b.textContent = pct(h.p);
        top.appendChild(b);
        top.appendChild(document.createTextNode(' · ' + ago(h.t)));
        tip.appendChild(top);
        var sub = document.createElement('small');
        sub.textContent = h.s ? (h.s === 'yes' ? 'long' : 'short') + ' $' + h.a : 'market opened';
        tip.appendChild(sub);
        var half = tip.offsetWidth / 2;
        tip.style.left = Math.min(w - half, Math.max(half, x)) + 'px';
    }
    function unhover() { cross.setAttribute('hidden', ''); dot.hidden = tip.hidden = true; }
    plot.addEventListener('pointermove', function (e) {
        var r = plot.getBoundingClientRect(), n = st.hist.length;
        hover(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n))));
    });
    plot.addEventListener('pointerleave', unhover);
    plot.addEventListener('pointercancel', unhover);

    // How it works
    var infoBtn = $('.pm-info-btn'), info = document.getElementById('pm-info');
    infoBtn.addEventListener('click', function () {
        var open = info.hidden;
        info.hidden = !open;
        infoBtn.setAttribute('aria-expanded', String(open));
    });

    syncSlider();
    render();
})();
