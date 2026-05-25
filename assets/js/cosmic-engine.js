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

// GLSL utility library, prepended to any page's act-specific shader code.
// Provides hash/noise, fbm, palettes, SDFs, raymarching helpers, blackbody color.
export const COSMIC_LIB = `
#define PI 3.14159265359
#define TAU 6.28318530718

float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3  hash33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i+vec2(0,0)),hash12(i+vec2(1,0)),u.x),
             mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y);
}

float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.-2.*f);
  float a = mix(hash12(i.xy+i.z*7.0), hash12(i.xy+vec2(1,0)+i.z*7.0), u.x);
  float b = mix(hash12(i.xy+vec2(0,1)+i.z*7.0), hash12(i.xy+vec2(1,1)+i.z*7.0), u.x);
  float c = mix(hash12(i.xy+(i.z+1.0)*7.0), hash12(i.xy+vec2(1,0)+(i.z+1.0)*7.0), u.x);
  float d = mix(hash12(i.xy+vec2(0,1)+(i.z+1.0)*7.0), hash12(i.xy+vec2(1,1)+(i.z+1.0)*7.0), u.x);
  return mix(mix(a,b,u.y), mix(c,d,u.y), u.z);
}

float fbm(vec2 p){
  float s=0., a=0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<6;i++){ s += a*vnoise(p); p = m*p; a *= 0.5; }
  return s;
}

float fbm3(vec3 p){
  float s=0., a=0.5;
  for(int i=0;i<5;i++){ s += a*vnoise3(p); p *= 2.03; a *= 0.5; }
  return s;
}

mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// Blackbody approximation in 1500–12000 K range (Krystek-ish), returns linear RGB.
vec3 blackbody(float kelvin){
  float t = clamp(kelvin, 1500., 12000.) / 100.0;
  float r = t <= 66. ? 255. : 329.698727446 * pow(t-60., -0.1332047592);
  float g = t <= 66. ? 99.4708025861 * log(t) - 161.1195681661 : 288.1221695283 * pow(t-60., -0.0755148492);
  float b = t >= 66. ? 255. : (t <= 19. ? 0. : 138.5177312231 * log(t-10.) - 305.0447927307);
  return clamp(vec3(r,g,b)/255., 0., 1.);
}

// IQ-style cosine palette
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b*cos(TAU*(c*t+d));
}

// Transient palettes
vec3 palGRB(float t){      return pal(t, vec3(.5,.2,.15), vec3(.6,.55,.45), vec3(1.0,1.0,1.0), vec3(.0,.15,.3)); }
vec3 palKilonova(float t){ return pal(t, vec3(.4,.2,.3),  vec3(.55,.5,.6),  vec3(1.0,.95,.9), vec3(.0,.1,.2)); }
vec3 palSLSN(float t){     return pal(t, vec3(.3,.45,.6), vec3(.5,.55,.5),  vec3(1.0,1.0,1.0), vec3(.0,.33,.67)); }
vec3 palTDE(float t){      return pal(t, vec3(.5,.35,.2), vec3(.5,.45,.4),  vec3(1.0,1.0,.8),  vec3(.0,.15,.25)); }
vec3 palAurora(float t){   return pal(t, vec3(.3,.5,.4),  vec3(.4,.5,.55),  vec3(1.0,1.0,1.0), vec3(.0,.2,.5)); }

// Star field — adaptive density, parallax via uv scale
float stars(vec2 uv, float density, float sharp){
  vec2 g = floor(uv*density);
  vec2 r = hash22(g);
  vec2 c = (fract(uv*density) - r);
  float d = dot(c,c);
  float bright = r.x*r.y;
  float twinkle = 0.7 + 0.3*sin(uTime*1.5 + bright*40.0);
  return smoothstep(0.0035*sharp, 0.0, d) * bright * twinkle;
}

// Soft glow disk
float disk(vec2 p, float r, float soft){
  return smoothstep(r+soft, r-soft, length(p));
}

// Sphere SDF
float sdSphere(vec3 p, float r){ return length(p)-r; }

// Torus (accretion disk) SDF
float sdTorus(vec3 p, vec2 t){
  vec2 q = vec2(length(p.xz)-t.x, p.y);
  return length(q)-t.y;
}

// HSV → RGB
vec3 hsv2rgb(vec3 c){
  vec3 p = abs(fract(c.xxx + vec3(0,2./3.,1./3.))*6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p-1.0, 0.0, 1.0), c.y);
}

// 2D ramp 0→1 between a and b
float ramp(float x, float a, float b){ return clamp((x-a)/max(b-a,1e-4), 0., 1.); }

// Smooth pulse centred at c with width w
float pulse(float x, float c, float w){ return smoothstep(c-w, c, x) - smoothstep(c, c+w, x); }
`;
