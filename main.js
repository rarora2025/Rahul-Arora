// now / prev toggle
document.querySelectorAll('.toggle button').forEach(function (btn) {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.toggle button').forEach(function (b) {
            b.setAttribute('aria-selected', String(b === btn));
        });
        document.querySelectorAll('.timeline').forEach(function (panel) {
            panel.hidden = panel.dataset.panel !== btn.dataset.tab;
        });
    });
});

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
