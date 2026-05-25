// Cosmic Engine — shared WebGL2 scroll-driven shader runtime.
// Page supplies a fragment shader and a list of act selectors;
// the engine drives uActIndex (continuous float) from scroll position.

const VERT = `#version 300 es
void main(){
  vec2 p = vec2(((gl_VertexID & 1) << 2) - 1, ((gl_VertexID & 2) << 1) - 1);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG_HEADER = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uActIndex;   // continuous: integer = current act, fract = progress within
uniform float uActCount;
uniform float uScrollY;
uniform vec2  uMouse;
uniform float uPixelRatio;
uniform float uReduced;    // 1.0 if prefers-reduced-motion
`;

export class CosmicEngine {
  constructor({ canvas, fragmentShader, acts = [], onTick = null }) {
    this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    if (!this.canvas) throw new Error('CosmicEngine: canvas not found');
    this.fragSource = fragmentShader;
    this.acts = acts;
    this.onTick = onTick;
    this.actIndex = 0;
    this.mouse = [0.5, 0.5];
    this.startTime = performance.now();
    this.running = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._init();
  }

  _init() {
    const gl = this.canvas.getContext('webgl2', {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      this.canvas.style.display = 'none';
      console.warn('[CosmicEngine] WebGL2 unsupported — shader fallback hidden');
      this.unsupported = true;
      return;
    }
    this.gl = gl;

    const vs = this._compile(gl.VERTEX_SHADER, VERT);
    const fs = this._compile(gl.FRAGMENT_SHADER, FRAG_HEADER + this.fragSource);
    if (!vs || !fs) { this.unsupported = true; return; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[CosmicEngine] link error:', gl.getProgramInfoLog(prog));
      this.unsupported = true;
      return;
    }
    this.program = prog;
    this.u = {
      uResolution: gl.getUniformLocation(prog, 'uResolution'),
      uTime:       gl.getUniformLocation(prog, 'uTime'),
      uActIndex:   gl.getUniformLocation(prog, 'uActIndex'),
      uActCount:   gl.getUniformLocation(prog, 'uActCount'),
      uScrollY:    gl.getUniformLocation(prog, 'uScrollY'),
      uMouse:      gl.getUniformLocation(prog, 'uMouse'),
      uPixelRatio: gl.getUniformLocation(prog, 'uPixelRatio'),
      uReduced:    gl.getUniformLocation(prog, 'uReduced'),
    };
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this._resize();
    addEventListener('resize', () => this._resize(), { passive: true });
    addEventListener('scroll', () => this._updateAct(), { passive: true });
    addEventListener('pointermove', e => {
      this.mouse[0] = e.clientX / innerWidth;
      this.mouse[1] = 1.0 - e.clientY / innerHeight;
    }, { passive: true });
    this._updateAct();
  }

  _compile(type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[CosmicEngine] shader compile error:\n' + gl.getShaderInfoLog(sh));
      // Log source with line numbers for debugging
      console.error(src.split('\n').map((l, i) => `${(i + 1).toString().padStart(3)}  ${l}`).join('\n'));
      return null;
    }
    return sh;
  }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, this.reduced ? 1.0 : 1.5);
    const w = innerWidth, h = innerHeight;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width  = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  _updateAct() {
    if (!this.acts.length) return;
    const scrollY = window.scrollY;
    const vh = innerHeight;
    let idx = 0;
    for (let i = 0; i < this.acts.length; i++) {
      const el = document.querySelector(this.acts[i].selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const top = rect.top + scrollY;
      const bot = top + rect.height;
      // Progress: 0 when section top hits viewport top, 1 when section bottom leaves viewport top
      const span = Math.max(rect.height, 1);
      const p = (scrollY - top + vh * 0.0) / span;
      if (p >= 0 && p <= 1) {
        idx = i + Math.max(0, Math.min(1, p));
        break;
      }
      if (p > 1) idx = i + 1;
    }
    this.actIndex = idx;
    this.scrollY = scrollY;
  }

  start() {
    if (this.unsupported || this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this._render();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); }

  _render() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.u.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, (performance.now() - this.startTime) / 1000);
    gl.uniform1f(this.u.uActIndex, this.actIndex);
    gl.uniform1f(this.u.uActCount, this.acts.length);
    gl.uniform1f(this.u.uScrollY, this.scrollY || 0);
    gl.uniform2f(this.u.uMouse, this.mouse[0], this.mouse[1]);
    gl.uniform1f(this.u.uPixelRatio, this.dpr);
    gl.uniform1f(this.u.uReduced, this.reduced ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.onTick) this.onTick(this);
  }
}

// GLSL utility library — cinematic primitives for scroll-driven shader stories.
// Multi-layer parallax starfield, volumetric raymarching, Kerr-like accretion disk
// with photon ring + Doppler beaming, spacetime grid warps from Schwarzschild,
// spiral galaxy, anamorphic lens flare, bloom approximation, domain-warped fbm,
// relativistic jets, GW polarization patterns, blackbody/spectral palettes.
export const COSMIC_LIB = `
#define PI 3.14159265359
#define TAU 6.28318530718

// ── Hashes ────────────────────────────────────────────────────────────
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3  hash33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float hash13(vec3 p){ p = fract(p*.1031); p += dot(p, p.yzx + 33.33); return fract((p.x+p.y)*p.z); }

// ── Value noise (2D / 3D) ─────────────────────────────────────────────
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i+vec2(0,0)),hash12(i+vec2(1,0)),u.x),
             mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y);
}
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.-2.*f);
  return mix(
    mix(mix(hash13(i+vec3(0,0,0)), hash13(i+vec3(1,0,0)), u.x),
        mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), u.x), u.y),
    mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), u.x),
        mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), u.x), u.y),
    u.z);
}

// ── FBM (rotated octaves for less axis bias) ─────────────────────────
float fbm(vec2 p){
  float s=0., a=0.5;
  mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<6;i++){ s += a*vnoise(p); p = m*p; a *= 0.5; }
  return s;
}
float fbm3(vec3 p){
  float s=0., a=0.5;
  for(int i=0;i<5;i++){ s += a*vnoise3(p); p *= 2.03; a *= 0.5; }
  return s;
}
// Ridged fbm (mountain-like; great for plasma filaments)
float rfbm(vec2 p){
  float s=0., a=0.5;
  mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ s += a*(1.0 - abs(vnoise(p)*2.0-1.0)); p = m*p; a *= 0.5; }
  return s;
}
// Domain-warped fbm — cinematic, painterly clouds
float warpFbm(vec2 p, float t){
  vec2 q = vec2(fbm(p + vec2(0., t*0.10)), fbm(p + vec2(5.2, 1.3 + t*0.08)));
  vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7, 9.2)), fbm(p + 4.0*q + vec2(8.3, 2.8)));
  return fbm(p + 4.0*r);
}
float warpFbm3(vec3 p, float t){
  vec3 q = vec3(fbm3(p + vec3(0.,0.,t*0.08)), fbm3(p + vec3(5.2,1.3,0.)), fbm3(p + vec3(1.7,9.2,t*0.06)));
  return fbm3(p + 2.0*q);
}

mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// ── Spectral colors ──────────────────────────────────────────────────
// Krystek blackbody (1500–12000 K)
vec3 blackbody(float kelvin){
  float t = clamp(kelvin, 1500., 12000.) / 100.0;
  float r = t <= 66. ? 255. : 329.698727446 * pow(t-60., -0.1332047592);
  float g = t <= 66. ? 99.4708025861 * log(t) - 161.1195681661 : 288.1221695283 * pow(t-60., -0.0755148492);
  float b = t >= 66. ? 255. : (t <= 19. ? 0. : 138.5177312231 * log(t-10.) - 305.0447927307);
  return clamp(vec3(r,g,b)/255., 0., 1.);
}

// IQ cosine palette
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b*cos(TAU*(c*t+d));
}

// Astrophysics-tuned palettes
vec3 palGRB(float t){      return pal(t, vec3(.5,.2,.15), vec3(.6,.55,.45), vec3(1.0,1.0,1.0), vec3(.0,.15,.3)); }
vec3 palKilonova(float t){ return pal(t, vec3(.4,.2,.3),  vec3(.55,.5,.6),  vec3(1.0,.95,.9), vec3(.0,.1,.2)); }
vec3 palSLSN(float t){     return pal(t, vec3(.3,.45,.6), vec3(.5,.55,.5),  vec3(1.0,1.0,1.0), vec3(.0,.33,.67)); }
vec3 palTDE(float t){      return pal(t, vec3(.5,.35,.2), vec3(.5,.45,.4),  vec3(1.0,1.0,.8),  vec3(.0,.15,.25)); }
vec3 palNebula(float t){   return pal(t, vec3(.45,.3,.5), vec3(.55,.4,.5),  vec3(1.0,1.0,.8),  vec3(.0,.2,.5)); }
vec3 palMagnetar(float t){ return pal(t, vec3(.3,.4,.6),  vec3(.4,.5,.55),  vec3(1.0,1.0,1.0), vec3(.0,.18,.40)); }

// Emission-line tints (rough, for nebulae)
vec3 emHalpha(){ return vec3(1.00, 0.35, 0.40); } // Hα 656nm
vec3 emOIII()  { return vec3(0.30, 0.95, 0.85); } // [O III] 500nm
vec3 emSII()   { return vec3(1.00, 0.55, 0.30); } // [S II] 671nm
vec3 emHbeta() { return vec3(0.55, 0.80, 1.00); } // Hβ 486nm

// ── Multi-layer parallax starfield + faint Milky-Way wash ─────────────
float starLayer(vec2 uv, float density, float sharp, float twinkleSpd, float phase){
  vec2 g = floor(uv*density);
  vec2 r = hash22(g + phase);
  vec2 c = (fract(uv*density) - r);
  float d = dot(c,c);
  float bright = pow(r.x*r.y, 1.8);
  float tw = 0.55 + 0.45*sin(uTime*twinkleSpd + bright*40.0 + phase);
  return smoothstep(0.0035*sharp, 0.0, d) * bright * tw;
}
// Legacy single-layer API (kept for back-compat)
float stars(vec2 uv, float density, float sharp){
  return starLayer(uv, density, sharp, 1.5, 0.0);
}
// Multi-layer parallax field with subtle galactic-plane wash + dust lanes.
// Black-theme: base is true black, milky-way band is dim warm/neutral
// (no overall blue cast), stars are slightly warm.
vec3 deepSky(vec2 uv){
  vec3 col = vec3(0.0, 0.0, 0.0);
  // Galactic plane: diagonal Milky-Way wash (very subtle, warm/neutral)
  vec2 gp = rot(0.5) * uv;
  float band = exp(-pow(gp.y*2.2, 2.0));
  float bandTex = warpFbm(gp*3.0 + vec2(uTime*0.01, 0.), uTime*0.02);
  vec3 bandCol = mix(vec3(0.10,0.09,0.08), vec3(0.20,0.15,0.10), 0.5+0.5*sin(gp.x*3.0));
  col += band * (0.05 + 0.04*bandTex) * bandCol;
  // Dust lanes (subtractive)
  float dust = smoothstep(0.45, 0.85, fbm(gp*5.0 + vec2(0., uTime*0.005)));
  col *= 1.0 - dust * band * 0.55;
  // Four parallax layers — keep stars warm so they read on pure black
  col += vec3(starLayer(uv*1.0,  90.,  1.0, 0.4, 7.0)) * vec3(1.00,0.95,0.85) * 0.65;
  col += vec3(starLayer(uv*1.4, 220.,  1.0, 0.9, 13.0)) * vec3(1.00,0.96,0.88) * 0.50;
  col += vec3(starLayer(uv*1.9, 460.,  0.9, 1.6, 21.0)) * vec3(1.00,0.92,0.78) * 0.35;
  col += vec3(starLayer(uv*2.6, 900.,  0.7, 2.4, 29.0)) * vec3(1.00,0.90,0.72) * 0.22;
  return col;
}

// ── Geometry helpers ──────────────────────────────────────────────────
float disk(vec2 p, float r, float soft){ return smoothstep(r+soft, r-soft, length(p)); }
float sdSphere(vec3 p, float r){ return length(p)-r; }
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz)-t.x, p.y); return length(q)-t.y; }
vec3 hsv2rgb(vec3 c){
  vec3 p = abs(fract(c.xxx + vec3(0,2./3.,1./3.))*6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p-1.0, 0.0, 1.0), c.y);
}
float ramp(float x, float a, float b){ return clamp((x-a)/max(b-a,1e-4), 0., 1.); }
float pulse(float x, float c, float w){ return smoothstep(c-w, c, x) - smoothstep(c, c+w, x); }

// ── Volumetric raymarched nebula (16 steps) ───────────────────────────
// Returns accumulated (emission, transmittance) — usable to composite over background.
// p2: uv. center: cloud center. radius: extent. innerHot/outerCold: color stops.
vec4 volNebula(vec2 p2, vec2 center, float radius, vec3 innerHot, vec3 outerCold, float density, float t){
  // Ray from "camera" along +z; we sample 3D density at z slabs
  vec3 ro = vec3(p2 - center, -radius*1.4);
  vec3 rd = vec3(0., 0., 1.);
  float dt = (radius*2.8) / 16.0;
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  for(int i=0;i<16;i++){
    vec3 P = ro + rd * (float(i)+0.5) * dt;
    float r3 = length(P) / radius;
    if(r3 > 1.6) continue;
    // Density: radial falloff × domain-warped 3D fbm
    float d = exp(-r3*r3*1.6);
    d *= 0.5 + 1.6*warpFbm3(P*2.4 + vec3(0., 0., t*0.12), t);
    d *= density;
    if(d < 0.005) continue;
    // Temperature: hotter toward the centre
    float temp = exp(-r3*1.2);
    vec3 c = mix(outerCold, innerHot, temp);
    // Beer's-law absorption
    float a = 1.0 - exp(-d * dt * 2.6);
    acc += c * a * trans;
    trans *= 1.0 - a;
    if(trans < 0.02) break;
  }
  return vec4(acc, trans);
}

// ── Kerr-like accretion disk with photon ring + Doppler beaming + lensing
// uv: screen-centered, BH at origin. tilt: 0=face-on, 1=edge-on. spin: 0-1.
// rs: gravitational radius in uv units. Returns final color contribution (additive over starfield).
vec3 accretionDisk(vec2 uv, float tilt, float spin, float rs, float t){
  // Disk plane is tilted; we render via "fake 3D" by warping ellipse coordinates.
  // ISCO: ~3*rs for non-spinning, ~1.2*rs for prograde maximal spin
  float rIn  = mix(3.0, 1.2, spin) * rs;
  float rOut = 30.0 * rs;
  float rPh  = 1.5 * rs; // photon sphere
  float horizon = mix(2.0, 1.05, spin) * rs;

  // Gravitational lensing of background: deflect uv around BH
  float r = length(uv);
  vec2 lensUv = uv;
  float defl = clamp(rs*2.0 / max(r, rs*0.5), 0.0, 0.9);
  lensUv = mix(uv, normalize(uv)*r*(1.0+defl), 1.0); // not used here, exported separately

  // Disk ellipse in screen space (tilted)
  vec2 dp = uv;
  dp.y /= max(1.0 - tilt*0.85, 0.10); // compress y when face-on -> circle; edge-on -> thin line
  float dr = length(dp);
  float ang = atan(dp.y, dp.x);

  // Radial profile (∝ r^{-3/4} thermal disk; tapered between rIn and rOut)
  float inMask  = smoothstep(rIn*0.95, rIn*1.05, dr);
  float outMask = 1.0 - smoothstep(rOut*0.6, rOut, dr);
  float radial  = inMask * outMask * pow(rs/max(dr, rs*0.5), 0.75);

  // Spiral hot-spot pattern (turbulent fingers in the disk)
  float spiral = 0.6 + 0.4*sin(ang*2.0 + dr*4.0/rs + t*1.4);
  float turb   = warpFbm(vec2(ang*2.5, dr*1.5/rs) + vec2(t*0.4, 0.0), t);
  float emiss  = radial * (0.6 + 0.7*spiral) * (0.7 + 0.6*turb);

  // Doppler beaming: side moving toward observer is brighter+bluer.
  // Approaching side at ang ~ -PI/2 if rotation CCW; beaming factor D = 1/(γ(1-β cosθ))
  float beta = 0.40 * (1.0 - tilt*0.3); // less projected beta when face-on
  float dop  = 1.0 / max(1.0 - beta * cos(ang - PI*0.5), 0.2);
  emiss *= pow(dop, 3.0); // intensity ∝ D^(3-α), α~0
  // Color shift (blueward toward, redward away)
  float kelvin = mix(2800., 11000., clamp(emiss*0.15, 0.0, 1.0) * dop * 0.6);
  vec3 col = blackbody(kelvin) * emiss * 1.6;

  // Inner edge bright (hot ISCO)
  col += smoothstep(rIn*1.6, rIn*0.95, dr) * smoothstep(rIn*0.85, rIn, dr) * vec3(1.4, 1.05, 0.7) * 1.4;

  // Photon ring: a bright thin ring at ~1.5 rs (visible only if we're not perfectly edge-on)
  float photonRing = exp(-pow((r-rPh)/(rs*0.07), 2.0)) * (0.6 - tilt*0.3);
  col += photonRing * vec3(1.2, 1.05, 0.85) * 2.4;

  // Subdisk shadow on far side (rough): darken half ellipse facing observer
  // (skipped — too costly without true raytracing)

  // Event horizon: pure black
  col *= smoothstep(horizon*0.92, horizon*1.08, r);

  return col;
}

// ── Spiral galaxy (logarithmic arms + bulge + halo + dust lanes) ─────
vec3 spiralGalaxy(vec2 uv, vec2 center, float scale, float t){
  vec2 p = (uv - center) / scale;
  // Tilt to make it look perspective
  p.y /= 0.50;
  float r = length(p);
  float a = atan(p.y, p.x);
  // Logarithmic spiral: arms when a + b*log(r) is near multiples of π/N
  float arms = 2.0;
  float pitch = 0.55;
  float armPhase = a*arms + pitch*log(max(r, 0.04)) - t*0.18;
  float armBright = pow(0.5+0.5*cos(armPhase), 4.0);
  // Stronger in middle band, fading at edges
  float disk = exp(-r*1.3) * smoothstep(0.04, 0.10, r);
  float arms_val = armBright * disk;
  // Color: blue-young along arms, redder in bulge
  vec3 armCol  = vec3(0.7, 0.85, 1.20);
  vec3 bulgeCol = vec3(1.10, 0.85, 0.55);
  // Bulge
  float bulge = exp(-r*r*22.0);
  // Halo
  float halo = exp(-r*0.7)*0.10;
  // Dust lane (dark between arms, subtractive)
  float dust = pow(0.5+0.5*cos(armPhase + PI), 6.0) * smoothstep(0.05, 0.3, r) * 0.5;
  // Per-star pop sprinkle along arms
  float sprinkle = 0.0;
  for(int i=0;i<4;i++){
    float fi=float(i);
    vec2 q = p*6.0 + vec2(fi*7.3, fi*3.1);
    float s = starLayer(q, 80., 0.8, 1.0, fi*5.0);
    sprinkle += s * armBright * 0.7;
  }
  vec3 col = arms_val*armCol*1.6 + bulge*bulgeCol*2.6 + halo*armCol*0.6;
  col *= 1.0 - dust;
  col += sprinkle * armCol;
  return col;
}

// ── Anamorphic lens flare (horizontal streak + ghost dots) ────────────
vec3 lensFlare(vec2 uv, vec2 src, vec3 tint, float intensity){
  vec2 d = uv - src;
  // Horizontal anamorphic streak
  float streak = exp(-pow(d.y, 2.0)*120.0) * exp(-abs(d.x)*1.4);
  vec3 col = streak * tint * 1.4;
  // Vertical (weaker)
  col += exp(-pow(d.x, 2.0)*220.0) * exp(-abs(d.y)*2.2) * tint * 0.4;
  // Ghost dots along the optical axis (toward center)
  for(int i=0;i<5;i++){
    float fi = float(i);
    vec2 gp = mix(src, -src, 0.2 + fi*0.15);
    float g = exp(-length(uv-gp)*30.0 - fi*0.4);
    col += g * mix(tint, vec3(1.0), 0.4) * (0.35 - fi*0.05);
  }
  return col * intensity;
}

// ── Cheap bloom-feel for hot pixels (sample-based) ────────────────────
// Pass it the "raw" color and the bright source; it adds glow around it.
vec3 hotGlow(vec3 col, vec2 uv, vec2 src, vec3 tint, float radius){
  float d = length(uv - src);
  return col + exp(-pow(d/radius, 1.7)*4.0) * tint;
}

// ── Schwarzschild spacetime grid (gravitational well warps a grid) ───
vec3 spacetimeGrid(vec2 uv, vec2 mPos, float mMass, vec3 gridCol, float density){
  // Warp coordinate by gravitational potential
  vec2 d = uv - mPos;
  float r = max(length(d), 0.04);
  vec2 warp = -d/r * mMass / r; // 1/r pull
  vec2 wuv = uv + warp;
  // Grid lines
  vec2 g = abs(fract(wuv*density) - 0.5);
  float line = smoothstep(0.06, 0.0, min(g.x, g.y));
  // Falloff with distance from source
  return gridCol * line * (0.4 + 0.6*exp(-r*1.2));
}

// ── Schwarzschild grid for two sources (binary) ───────────────────────
vec3 spacetimeGrid2(vec2 uv, vec2 pA, float mA, vec2 pB, float mB, vec3 gridCol, float density){
  vec2 dA = uv - pA, dB = uv - pB;
  float rA = max(length(dA), 0.04), rB = max(length(dB), 0.04);
  vec2 warp = -dA/rA * mA / rA - dB/rB * mB / rB;
  vec2 wuv = uv + warp;
  vec2 g = abs(fract(wuv*density) - 0.5);
  float line = smoothstep(0.06, 0.0, min(g.x, g.y));
  return gridCol * line * (0.3 + 0.7*exp(-min(rA,rB)*1.0));
}

// ── GW + and × polarization patterns on a ring ────────────────────────
// Strain pattern h(t) ~ cos(ωt) for + and sin(2θ) modulation
float gwPlus(vec2 uv, float freq, float phase){
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  return cos(2.0*a) * cos(freq*r - phase) * exp(-r*0.6);
}
float gwCross(vec2 uv, float freq, float phase){
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  return sin(2.0*a) * sin(freq*r - phase) * exp(-r*0.6);
}

// ── Relativistic jet with Lorentz boost and knots ────────────────────
// dir: unit vector for jet axis; lor: bulk Lorentz factor (1..30)
vec3 relJet(vec2 uv, vec2 dir, float len, float width, float lor, vec3 tint, float t){
  // Project uv onto dir and perpendicular
  float along = dot(uv, dir);
  vec2 perp = uv - along*dir;
  float across = length(perp);
  // Length window: 0..len
  float lenMask = smoothstep(len, len*0.94, along) * smoothstep(0.0, 0.05, along);
  // Width tapering (narrower far away)
  float w = width * (1.0 - 0.6*smoothstep(0.0, len, along));
  float withinJet = smoothstep(w, w*0.4, across);
  // Knots from internal-shock variability
  float knot = 0.55 + 0.45*sin(along*22.0 - t*lor*0.4);
  float intensity = lenMask * withinJet * (0.55 + 0.6*knot);
  // Doppler boost — front of jet brighter (toward viewer for along.dir<0)
  intensity *= pow(lor / max(lor - 0.5, 0.5), 1.5);
  // Color: bluer at relativistic boost
  vec3 col = mix(tint, vec3(0.55,0.75,1.4), clamp(lor/30.0, 0.0, 1.0));
  return col * intensity * 1.4;
}

// ── World line for Minkowski diagram (CV act) ────────────────────────
// Returns brightness of an event at uv given a worldline (parametrized by time tau)
float worldLineBrightness(vec2 uv, vec2 src, vec2 dir, float length_, float thickness){
  // Distance from point to line segment
  float h = clamp(dot(uv-src, dir)/dot(dir,dir), 0.0, length_);
  vec2 proj = src + dir*h;
  float d = length(uv - proj);
  return smoothstep(thickness, 0.0, d);
}
`;
