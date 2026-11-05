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

// Play-money prediction market. An LMSR market maker prices Yes/No, background bots
// trade on a timer (pulling the price back toward ~94%), and visitors can place trades.
(function () {
    var root = document.getElementById('pm');
    var modal = document.getElementById('pm-modal');
    if (!root || !modal) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var B = 150, ANCHOR = 0.94, KEY = 'pm-rahul-v1';
    function price(q) { var a = Math.exp(q.y / B), c = Math.exp(q.n / B); return a / (a + c); }
    // Start q so that the Yes price is the anchor
    var q = { y: B * Math.log(ANCHOR / (1 - ANCHOR)), n: 0 };

    // Shares bought by spending x on side s: cost(q') - cost(q) = x
    function sharesFor(qs, side, x) {
        var a = (side === 'yes' ? qs.y : qs.n) / B, c = (side === 'yes' ? qs.n : qs.y) / B;
        var m = Math.max(a, c), ea = Math.exp(a - m), ec = Math.exp(c - m);
        return B * (Math.log(Math.exp(x / B) * (ea + ec) - ec) - (a - m));
    }
    function apply(qs, side, x) {
        var d = sharesFor(qs, side, x), out = { y: qs.y, n: qs.n };
        out[side === 'yes' ? 'y' : 'n'] += d;
        return { q: out, shares: d };
    }

    // Seed a believable 24h history with a random walk toward the anchor
    var hist = [], vol = 1800 + Math.round(Math.random() * 900), p = 0.9 + Math.random() * 0.05;
    for (var i = 0; i < 47; i++) {
        p += (ANCHOR - p) * 0.15 + (Math.random() - 0.5) * 0.03;
        p = Math.min(0.99, Math.max(0.8, p));
        hist.push(p);
    }
    hist.push(price(q));

    var pos = { yes: 0, no: 0, spent: 0 };
    try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved) pos = saved; } catch (e) {}
    function save() { try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch (e) {} }

    var $ = function (sel) { return root.querySelector(sel); };
    var line = $('[data-line]'), area = $('[data-area]'), feed = $('[data-feed]'), posEl = $('[data-pos]');

    function cents(v) { return Math.round(v * 100) + '¢'; }
    function money(v) { return '$' + Math.round(v).toLocaleString('en-US'); }

    function draw() {
        var lo = Math.min.apply(null, hist) - 0.02, hi = Math.max.apply(null, hist) + 0.02;
        var pts = hist.map(function (v, i) {
            return [(i / (hist.length - 1)) * 300, 70 - ((v - lo) / (hi - lo)) * 66];
        });
        var d = pts.map(function (pt, i) { return (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ');
        line.setAttribute('d', d);
        area.setAttribute('d', d + ' L300 72 L0 72 Z');
    }

    function render() {
        var py = price(q);
        document.querySelectorAll('[data-pct]').forEach(function (el) { el.textContent = Math.round(py * 100) + '%'; });
        document.querySelectorAll('[data-yes]').forEach(function (el) { el.textContent = cents(py); });
        document.querySelectorAll('[data-no]').forEach(function (el) { el.textContent = cents(1 - py); });
        var ch = (py - hist[0]) * 100, chEl = $('[data-change]');
        chEl.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(1) + '% 24h';
        chEl.classList.toggle('up', ch >= 0);
        chEl.classList.toggle('down', ch < 0);
        $('[data-vol]').textContent = money(vol);
        if (pos.yes || pos.no) {
            posEl.hidden = false;
            var parts = [];
            if (pos.yes) parts.push(pos.yes.toFixed(1) + ' Yes');
            if (pos.no) parts.push(pos.no.toFixed(1) + ' No');
            var worth = pos.yes * py + pos.no * (1 - py);
            posEl.textContent = 'you hold ' + parts.join(' + ') + ' \u00b7 worth $' + worth.toFixed(2);
        }
        draw();
    }

    function trade(side, x, who) {
        var r = apply(q, side, x);
        q = r.q;
        vol += x;
        hist.push(price(q));
        if (hist.length > 48) hist.shift();
        feed.innerHTML = '';
        var s = document.createElement('span');
        s.textContent = who + ' bought $' + Math.round(x) + ' ' + (side === 'yes' ? 'Yes' : 'No') + ' · now ' + Math.round(price(q) * 100) + '%';
        if (!reduced) s.className = 'flash';
        feed.appendChild(s);
        render();
        return r.shares;
    }

    // Background traders: mostly small, leaning toward the anchor, with some noise
    var NAMES = ['someone', 'a recruiter', 'a classmate', 'a bot', 'an anon', 'a founder'];
    function bot() {
        var py = price(q), lean = (ANCHOR - py) * 12;
        var side = Math.random() < 0.5 + lean ? 'yes' : 'no';
        if (py > 0.985) side = 'no';
        if (py < 0.82) side = 'yes';
        // Spend scales with the side's price so cheap No shares don't swing the market
        trade(side, Math.max(1, (1 + Math.random() * 39) * (side === 'yes' ? py : (1 - py) * 3)), NAMES[Math.floor(Math.random() * NAMES.length)]);
        setTimeout(bot, 2500 + Math.random() * 2500);
    }
    setTimeout(bot, 2000);

    // How it works
    var infoBtn = $('.pm-info-btn'), info = document.getElementById('pm-info');
    infoBtn.addEventListener('click', function () {
        var open = info.hidden;
        info.hidden = !open;
        infoBtn.setAttribute('aria-expanded', String(open));
    });

    // Trade modal
    var side = 'yes', amt = modal.querySelector('[data-amt]'), go = modal.querySelector('[data-go]');
    function pick(s) {
        side = s;
        modal.querySelectorAll('.pm-side').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.pick === s)); });
        go.classList.toggle('no', s === 'no');
        quote();
    }
    function quote() {
        var x = Math.min(1000, Math.max(0, Number(amt.value) || 0));
        var set = function (k, v) { modal.querySelector('[data-q-' + k + ']').textContent = v; };
        if (!x) { ['avg', 'shares', 'pay', 'after'].forEach(function (k) { set(k, '–'); }); go.disabled = true; return; }
        var r = apply(q, side, x), after = price(r.q);
        set('avg', cents(x / r.shares));
        set('shares', r.shares.toFixed(1));
        set('pay', '$' + r.shares.toFixed(2));
        set('after', Math.round((side === 'yes' ? after : 1 - after) * 100) + '%');
        go.disabled = false;
        go.textContent = 'Buy ' + (side === 'yes' ? 'Yes' : 'No') + ' for $' + Math.round(x);
    }

    root.querySelectorAll('.m-row button').forEach(function (b) {
        b.addEventListener('click', function () {
            pick(b.dataset.side);
            if (modal.showModal) modal.showModal(); else modal.setAttribute('open', '');
        });
    });
    modal.querySelectorAll('.pm-side').forEach(function (b) { b.addEventListener('click', function () { pick(b.dataset.pick); }); });
    modal.querySelectorAll('[data-add]').forEach(function (b) {
        b.addEventListener('click', function () {
            amt.value = Math.min(1000, (Number(amt.value) || 0) + Number(b.dataset.add));
            quote();
        });
    });
    amt.addEventListener('input', quote);
    // Close when clicking the backdrop
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
    // Live quote while bots move the price
    setInterval(function () { if (modal.open) quote(); }, 1000);

    go.addEventListener('click', function () {
        var x = Math.min(1000, Math.max(0, Number(amt.value) || 0));
        if (!x) return;
        var shares = trade(side, x, 'you');
        pos[side] += shares;
        pos.spent += x;
        save();
        render();
        modal.close();
    });

    render();
})();
