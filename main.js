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

// Flickable name. Each letter becomes a little ball: drag and release to throw it,
// or click to pop it up. Gravity pulls it to the bottom of the viewport, and once it
// settles it walks back home.
(function () {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var letters = Array.prototype.slice.call(document.querySelectorAll('.name .l'));
    var GRAVITY = 2400, BOUNCE = 0.55, FRICTION = 0.985, REST_MS = 1400, HOME_MS = 650;

    var bodies = letters.map(function (el) {
        return { el: el, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, state: 'home', restAt: 0 };
    });

    var running = false, last = 0;

    function bounds(b) {
        // Letter's home box in viewport coords, so we can keep it on screen
        var rect = b.el.getBoundingClientRect();
        var homeLeft = rect.left - b.x, homeTop = rect.top - b.y;
        return {
            minX: -homeLeft,
            maxX: document.documentElement.clientWidth - homeLeft - rect.width,
            maxY: window.innerHeight - homeTop - rect.height - 8
        };
    }

    function render(b) {
        b.el.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px) rotate(' + b.r + 'deg)';
    }

    function tick(now) {
        var dt = Math.min((now - last) / 1000, 1 / 30);
        last = now;
        var active = false;

        bodies.forEach(function (b) {
            if (b.state === 'flying') {
                active = true;
                var lim = bounds(b);
                b.vy += GRAVITY * dt;
                b.vx *= FRICTION;
                b.vr *= FRICTION;
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.r += b.vr * dt;

                if (b.x < lim.minX) { b.x = lim.minX; b.vx = Math.abs(b.vx) * BOUNCE; }
                if (b.x > lim.maxX) { b.x = lim.maxX; b.vx = -Math.abs(b.vx) * BOUNCE; }
                if (b.y > lim.maxY) {
                    b.y = lim.maxY;
                    b.vy = -Math.abs(b.vy) * BOUNCE;
                    b.vx *= 0.8;
                    b.vr *= 0.7;
                    if (Math.abs(b.vy) < 60) b.vy = 0;
                }

                var resting = b.vy === 0 && Math.abs(b.vx) < 20;
                if (resting) {
                    if (!b.restAt) b.restAt = now;
                    if (now - b.restAt > REST_MS) goHome(b, now);
                } else {
                    b.restAt = 0;
                }
                render(b);
            } else if (b.state === 'returning') {
                active = true;
                var t = Math.min((now - b.t0) / HOME_MS, 1);
                var e = 1 - Math.pow(1 - t, 3);
                b.x = b.fx * (1 - e);
                b.y = b.fy * (1 - e) - Math.sin(Math.PI * t) * 40;
                b.r = b.fr * (1 - e);
                render(b);
                if (t === 1) {
                    b.state = 'home';
                    b.x = b.y = b.r = 0;
                    b.el.style.transform = '';
                    b.el.classList.remove('flying');
                }
            } else if (b.state === 'held') {
                active = true;
            }
        });

        if (active) requestAnimationFrame(tick);
        else running = false;
    }

    function start() {
        if (running) return;
        running = true;
        last = performance.now();
        requestAnimationFrame(tick);
    }

    function goHome(b, now) {
        b.state = 'returning';
        b.t0 = now;
        b.fx = b.x; b.fy = b.y; b.fr = b.r % 360;
        b.restAt = 0;
    }

    function launch(b, vx, vy) {
        b.state = 'flying';
        b.vx = vx;
        b.vy = vy;
        b.vr = vx * 0.6 + (Math.random() - 0.5) * 400;
        b.restAt = 0;
        b.el.classList.add('flying');
        start();
    }

    if (reduced) return;

    bodies.forEach(function (b) {
        var drag = null;

        b.el.addEventListener('pointerdown', function (ev) {
            ev.preventDefault();
            b.el.setPointerCapture(ev.pointerId);
            b.state = 'held';
            b.el.classList.add('flying');
            drag = { sx: ev.clientX - b.x, sy: ev.clientY - b.y, px: ev.clientX, py: ev.clientY, pt: ev.timeStamp, vx: 0, vy: 0, moved: 0 };
            start();
        });

        b.el.addEventListener('pointermove', function (ev) {
            if (!drag) return;
            var dt = Math.max(ev.timeStamp - drag.pt, 1) / 1000;
            drag.vx = (ev.clientX - drag.px) / dt;
            drag.vy = (ev.clientY - drag.py) / dt;
            drag.moved += Math.abs(ev.clientX - drag.px) + Math.abs(ev.clientY - drag.py);
            drag.px = ev.clientX; drag.py = ev.clientY; drag.pt = ev.timeStamp;
            b.x = ev.clientX - drag.sx;
            b.y = ev.clientY - drag.sy;
            render(b);
        });

        function release() {
            if (!drag) return;
            if (drag.moved < 6) {
                // A click: pop it up with a bit of sideways spin
                launch(b, (Math.random() - 0.5) * 500, -900 - Math.random() * 300);
            } else {
                var cap = 3000;
                launch(b, Math.max(-cap, Math.min(cap, drag.vx)), Math.max(-cap, Math.min(cap, drag.vy)));
            }
            drag = null;
        }

        b.el.addEventListener('pointerup', release);
        b.el.addEventListener('pointercancel', release);
    });
})();
