/* =============================================================================
   aurora-background.js  ·  drop-in animated Aurora wallpaper
   -----------------------------------------------------------------------------
   A self-contained, dependency-free WebGL aurora that sits behind your page,
   follows the cursor, drifts on its own when idle, and ripples on click.

   USAGE
   -----
   1. Save this file next to your site's HTML (e.g. in the same folder).
   2. Add ONE line before </body>:
          <script src="aurora-background.js"></script>
   3. Make sure your page content sits ABOVE it — see the CSS note at the bottom
      of this file (most sites need nothing; this canvas is fixed at z-index -1).

   OPTIONAL TUNING
   ---------------
   Define a config object BEFORE loading this script to tweak it:
          <script>
            window.AURORA_CONFIG = {
              intensity: 0.85,   // 0.3 = subtle, 1.4 = vivid   (default 1.0)
              speed:     1.0,    // animation speed multiplier   (default 1.0)
              follow:    true,   // react to mouse position       (default true)
              ripples:   true,   // ripple on click               (default true)
              zIndex:   -1       // stacking order                (default -1)
            };
          </script>
          <script src="aurora-background.js"></script>
============================================================================= */
(function () {
  'use strict';

  var CFG = Object.assign(
    { intensity: 1.0, speed: 1.0, follow: true, ripples: true, zIndex: -1 },
    window.AURORA_CONFIG || {}
  );

  /* ---- canvas, fixed behind everything ---------------------------------- */
  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  var s = canvas.style;
  s.position = 'fixed';
  s.top = '0'; s.left = '0';
  s.width = '100%'; s.height = '100%';
  s.zIndex = String(CFG.zIndex);
  s.pointerEvents = 'none';        // clicks/scroll pass through to your page
  s.display = 'block';

  var gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, premultipliedAlpha: false
  });
  if (!gl) { console.warn('[aurora] WebGL unavailable — skipping background.'); return; }

  function mount() {
    document.body.appendChild(canvas);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  /* ---- shaders ----------------------------------------------------------- */
  var VERT =
    'attribute vec2 a_pos;' +
    'void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',
    'uniform float u_time;',
    'uniform vec2  u_res;',
    'uniform vec2  u_mouse;',     // 0..1, y up (smoothed)
    'uniform float u_intensity;',
    'uniform vec3  u_clicks[8];', // x01, y01, clickTime ; z<-0.5 = empty',

    'float hash21(vec2 p){',
    '  p = fract(p * vec2(123.34, 345.45));',
    '  p += dot(p, p + 34.345);',
    '  return fract(p.x * p.y);',
    '}',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  float a = hash21(i);',
    '  float b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0));',
    '  float d = hash21(i + vec2(1.0, 1.0));',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);',
    '  for(int i = 0; i < 6; i++){ v += a * vnoise(p); p = m * p; a *= 0.5; }',
    '  return v;',
    '}',
    'vec2 cuv(vec2 fc){ return (fc * 2.0 - u_res) / min(u_res.x, u_res.y); }',
    'vec2 toCentered(vec2 p01){ return u_res * (2.0 * p01 - 1.0) / min(u_res.x, u_res.y); }',
    'float clickField(vec2 uv){',
    '  float s = 0.0;',
    '  for(int i = 0; i < 8; i++){',
    '    vec3 c = u_clicks[i];',
    '    if(c.z < -0.5) continue;',
    '    float age = u_time - c.z;',
    '    if(age < 0.0 || age > 2.2) continue;',
    '    float d = length(uv - toCentered(c.xy));',
    '    float r = age * 1.15;',
    '    s += smoothstep(0.13, 0.0, abs(d - r)) * (1.0 - age / 2.2);',
    '  }',
    '  return s;',
    '}',
    'vec3 auroraPal(float h){',
    '  vec3 a = vec3(0.16, 0.95, 0.55);',  // green
    '  vec3 b = vec3(0.10, 0.80, 0.96);',  // teal
    '  vec3 c = vec3(0.45, 0.45, 0.99);',  // indigo
    '  vec3 d = vec3(0.86, 0.36, 0.96);',  // magenta
    '  float s = fract(h) * 4.0;',
    '  if(s < 1.0)      return mix(a, b, s);',
    '  else if(s < 2.0) return mix(b, c, s - 1.0);',
    '  else if(s < 3.0) return mix(c, d, s - 2.0);',
    '  else             return mix(d, a, s - 3.0);',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  vec2 p  = cuv(gl_FragCoord.xy);',
    '  vec2 m  = u_mouse;',
    '  float t = u_time * 0.12;',

    '  vec3 col = mix(vec3(0.045, 0.03, 0.085), vec3(0.015, 0.03, 0.065), uv.y);',

    '  float st = hash21(floor(gl_FragCoord.xy / 2.5));',
    '  st = step(0.9975, st) * smoothstep(0.35, 1.0, uv.y);',
    '  col += vec3(st) * (0.4 + 0.6 * sin(u_time * 3.0 + uv.x * 60.0)) * 0.7;',

    '  float mx = m.x - 0.5;',
    '  float my = m.y - 0.5;',
    '  for(int i = 0; i < 4; i++){',
    '    float fi = float(i);',
    '    float base = 0.40 + fi * 0.075 + my * 0.28;',
    '    float wave = 0.10 * sin(uv.x * 3.0 + t * 6.0 + fi * 1.9)',
    '               + 0.075 * fbm(vec2(uv.x * 2.5 - t * 2.0 + mx * 2.2, fi * 7.0));',
    '    float y = base + wave;',
    '    float d = abs(uv.y - y);',
    '    float streak = fbm(vec2(uv.x * 11.0 + fi * 5.0, uv.y * 3.0 - t * 4.0));',
    '    float glow = 0.011 / (d * d + 0.0010);',
    '    glow *= 0.30 + 0.95 * streak;',
    '    glow *= exp(-max(0.0, uv.y - y) * 2.2);',
    '    float h = fi * 0.17 + uv.x * 0.25 + mx * 0.30 + t * 0.30;',
    '    col += auroraPal(h) * glow * 0.5;',
    '  }',

    '  col += auroraPal(0.4) * clickField(p) * 0.7;',
    '  col *= 1.0 - 0.34 * length(uv - 0.5);',
    '  col *= u_intensity;',
    '  col = max(col, 0.0);',
    '  col = col / (1.0 + col * 0.65);',   // soft rolloff keeps highlights coloured
    '  col = pow(col, vec3(0.85));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---- program build ----------------------------------------------------- */
  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[aurora] shader error:\n' + gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[aurora] link error:', gl.getProgramInfoLog(prog)); return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uTime  = gl.getUniformLocation(prog, 'u_time');
  var uRes   = gl.getUniformLocation(prog, 'u_res');
  var uMouse = gl.getUniformLocation(prog, 'u_mouse');
  var uInt   = gl.getUniformLocation(prog, 'u_intensity');
  var uClk   = gl.getUniformLocation(prog, 'u_clicks');

  /* ---- state ------------------------------------------------------------- */
  var dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  var target = { x: 0.5, y: 0.5 };
  var smooth = { x: 0.5, y: 0.5 };
  var lastMove = -99;
  var start = performance.now() / 1000;
  var clicks = new Float32Array(24);
  for (var i = 0; i < 8; i++) clicks[i * 3 + 2] = -99;
  var ci = 0;

  function resize() {
    var w = Math.max(1, Math.round(window.innerWidth  * dpr));
    var h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  window.addEventListener('resize', resize);

  if (CFG.follow) {
    window.addEventListener('pointermove', function (e) {
      target.x = e.clientX / window.innerWidth;
      target.y = 1 - e.clientY / window.innerHeight;
      lastMove = performance.now() / 1000;
    }, { passive: true });
  }
  if (CFG.ripples) {
    window.addEventListener('pointerdown', function (e) {
      var x = e.clientX / window.innerWidth;
      var y = 1 - e.clientY / window.innerHeight;
      clicks[ci * 3] = x; clicks[ci * 3 + 1] = y;
      clicks[ci * 3 + 2] = performance.now() / 1000 - start;
      ci = (ci + 1) % 8;
    }, { passive: true });
  }

  /* ---- render loop ------------------------------------------------------- */
  var running = true;
  // pause when tab hidden to save battery
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });

  function frame() {
    if (!running) return;
    resize();
    var now = performance.now() / 1000;
    var t = (now - start) * CFG.speed;

    if (now - lastMove > 2.2) {           // idle autopilot
      target.x = 0.5 + 0.32 * Math.sin(t * 0.27);
      target.y = 0.5 + 0.26 * Math.cos(t * 0.21);
    }
    smooth.x += (target.x - smooth.x) * 0.07;
    smooth.y += (target.y - smooth.y) * 0.07;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uMouse, smooth.x, smooth.y);
    gl.uniform1f(uInt, CFG.intensity);
    gl.uniform3fv(uClk, clicks);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);
})();

/* =============================================================================
   CSS NOTE — making your content readable on top
   -----------------------------------------------------------------------------
   The canvas is position:fixed at z-index -1, so in most cases your existing
   content already sits on top and stays fully clickable. If your <body> has an
   opaque background colour, it will HIDE the aurora — set it transparent:

       body { background: transparent; }

   For crisp legibility over the moving light, give text blocks a calm backdrop,
   e.g.:

       .content {                       // whatever wraps your text
         background: rgba(8, 9, 16, 0.55);
         backdrop-filter: blur(10px);
         border-radius: 16px;
         padding: 2rem;
       }

   Tip: lower window.AURORA_CONFIG.intensity (e.g. 0.6) if it competes with text.
============================================================================= */
