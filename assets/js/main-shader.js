import { COSMIC_LIB } from './cosmic-engine.js';

export const MAIN_FRAGMENT = COSMIC_LIB + `

// =============================================================
// ACT 0 — HERO: molecular cloud collapsing into a protostar
// =============================================================
vec3 actBirth(vec2 uv, float p){
  // p 0..1 — cloud collapses, star ignites
  vec2 q = uv;
  float t = uTime;

  // Background void with extremely faint stars
  vec3 col = vec3(0.005, 0.008, 0.020);
  col += vec3(stars(uv*1.5 + vec2(0., t*0.005), 220., 1.0)) * 0.6;
  col += vec3(stars(uv*3.0 + vec2(t*0.003, 0.), 480., 0.9)) * 0.3;

  // Cold gas filaments (large-scale fbm) — they contract toward center as p increases
  float contract = mix(1.4, 0.45, smoothstep(0., 0.85, p));
  vec2 nbUV = q * contract;
  float n = fbm(nbUV*2.5 + vec2(t*0.02, -t*0.013));
  float n2 = fbm(nbUV*5.0 - vec2(t*0.04, t*0.025));
  float radial = exp(-length(q*contract)*1.6);
  float gas = smoothstep(0.35, 0.95, n*0.7 + n2*0.5) * (0.35 + 0.65*radial);

  // Cold nebula color shifts from blue to warmer as gravitational heating starts
  vec3 nebCool = vec3(0.18, 0.30, 0.55);
  vec3 nebWarm = vec3(0.95, 0.55, 0.30);
  vec3 nebCol = mix(nebCool, nebWarm, smoothstep(0.25, 0.95, p));
  col += gas * nebCol * (0.6 + 0.4*p);

  // Protostellar disk and central ignition — appears after p > 0.35
  float ignite = smoothstep(0.30, 0.80, p);
  float coreR = mix(0.0, 0.10, ignite);
  float core = disk(q, coreR, 0.04) * ignite;
  vec3 starCol = blackbody(mix(2400., 6500., smoothstep(0.4, 1.0, p)));
  col += core * starCol * (1.5 + 6.0*ignite);

  // Soft photospheric halo
  float halo = exp(-length(q)*5.0) * ignite * 1.2;
  col += halo * starCol * 0.5;

  // Bipolar jet hints — vertical accretion outflow
  float jetX = abs(q.x);
  float jet = smoothstep(0.07, 0.0, jetX) * (1.0 - smoothstep(0.0, 0.55, abs(q.y))) * pow(ignite, 2.0);
  col += jet * vec3(0.7, 0.85, 1.0) * 0.5;

  // Subtle accretion disk ellipse
  float disk1 = smoothstep(0.30, 0.28, length(q*vec2(1.0, 4.0))) * (1.0 - smoothstep(0.0, 0.12, length(q*vec2(1.0, 4.0))));
  col += disk1 * vec3(1.0, 0.7, 0.4) * ignite * 1.4;

  return col;
}

// =============================================================
// ACT 1 — ABOUT: main-sequence star with corona + planet trails
// =============================================================
vec3 actMainSequence(vec2 uv, float p){
  vec2 q = uv;
  float t = uTime;
  vec3 col = vec3(0.006, 0.009, 0.022);

  // Background stars (deep field)
  col += vec3(stars(uv*2.0 + vec2(t*0.008, 0.), 300., 0.9)) * 0.5;

  // Star at center — granulation simulated with fbm in spherical coords
  float r = length(q);
  float surfaceR = 0.18;
  vec2 sph = vec2(atan(q.y, q.x), r);

  // Limb darkening factor
  float limb = smoothstep(surfaceR, surfaceR*0.55, r);

  // Granulation
  float gran = fbm(vec2(cos(sph.x)*1.8, sin(sph.x)*1.8) * 4.0 + vec2(t*0.15, -t*0.10) + sph.y*3.0);
  gran += 0.5*fbm(vec2(cos(sph.x)*4., sin(sph.x)*4.) * 8.0 - vec2(t*0.3));
  gran = smoothstep(0.35, 0.95, gran);

  // Star color drifts toward G-type yellow
  float kelvin = mix(4500., 5900., p);
  vec3 phot = blackbody(kelvin);
  col = mix(col, phot * (0.7 + 0.6*gran), limb);

  // Corona — soft outer glow with flickering rays
  float coronaR = mix(0.40, 0.55, p);
  float coronaGlow = exp(-pow((r-surfaceR)/coronaR, 2.0)*4.5) * (1.0 - limb);
  // Flares — radial spikes
  float ang = atan(q.y, q.x);
  float flare = 0.35 + 0.65*pow(0.5+0.5*sin(ang*6.0 + fbm(vec2(ang*2.0, t*0.6))*5.0 + t*1.1), 5.0);
  coronaGlow *= flare;
  col += coronaGlow * mix(vec3(1.0,0.7,0.35), vec3(1.0,0.9,0.65), p) * 1.4;

  // Three orbital trails — drawn as soft ellipse rings
  for(int i=0;i<3;i++){
    float fi = float(i);
    float orbR = 0.28 + fi*0.12;
    float tilt = 0.18 + fi*0.06;
    vec2 op = q;
    op = rot(0.4 + fi*0.2) * op;
    op.y /= max(tilt, 0.05);
    float d = abs(length(op) - orbR);
    float ring = smoothstep(0.012, 0.0, d) * (0.45 - fi*0.07);
    col += ring * vec3(0.55, 0.75, 1.0);

    // Planet bead
    float ph = t*(0.5 - fi*0.12) + fi*2.1;
    vec2 plPos = vec2(cos(ph)*orbR, sin(ph)*orbR*tilt);
    plPos = rot(-0.4 - fi*0.2) * plPos;
    float plD = length(q - plPos);
    col += smoothstep(0.012, 0.0, plD) * vec3(1.0, 0.9, 0.7) * (0.7 - fi*0.1);
  }

  // Soft inner glow
  col += exp(-r*3.0)*0.10 * phot;

  return col;
}

// =============================================================
// ACT 2 — RESEARCH: 2×2 manifold of transient previews
// =============================================================
vec3 transientCell(vec2 q, int kind, float p){
  // q is in local cell space, roughly -1..1
  vec3 c = vec3(0.0);
  float t = uTime;
  float r = length(q);

  if(kind==0){ // GRB — bipolar relativistic jet
    float jet = (1.0 - smoothstep(0.0, 0.55, abs(q.x))) * (1.0 - smoothstep(0.0, 0.85, abs(q.y)));
    jet *= 0.4 + 0.6*sin(q.y*8.0 - t*4.0)*0.5+0.5;
    c += jet * palGRB(0.4 + 0.3*sin(t)) * 1.2;
    float core = exp(-r*8.0)*1.2;
    c += core * vec3(1.0, 0.85, 0.6);
  } else if(kind==1){ // Kilonova — NS-NS spiral
    float ph = t*1.2;
    vec2 a = vec2(cos(ph), sin(ph))*0.22;
    vec2 b = -a;
    float da = length(q-a), db = length(q-b);
    c += exp(-da*22.0)*vec3(0.85,0.9,1.0)*1.3;
    c += exp(-db*22.0)*vec3(1.0,0.85,0.95)*1.3;
    // ejecta ring after merger pulse
    float pulse = 0.5+0.5*sin(t*0.8);
    float ring = smoothstep(0.04,0.0,abs(r - 0.35 - 0.05*pulse));
    c += ring * palKilonova(t*0.2) * 0.7;
  } else if(kind==2){ // SLSN — bright transient with flux
    float core = exp(-r*r*16.0);
    float pump = 0.7 + 0.3*sin(t*0.8);
    c += core * vec3(0.65, 0.85, 1.2) * (1.5 + pump);
    // halo
    float halo = exp(-r*3.5);
    c += halo * palSLSN(t*0.1) * 0.6;
    // spikes
    float ang = atan(q.y, q.x);
    float sp = pow(0.5+0.5*sin(ang*8.0 + t*1.5), 6.0);
    c += sp*halo*vec3(0.7,0.9,1.0)*0.5;
  } else { // TDE — accretion disk around BH
    // Disk in ellipse
    vec2 dp = q;
    dp.y *= 2.6;
    float d = length(dp);
    float disk = smoothstep(0.42, 0.40, d) * (1.0 - smoothstep(0.10, 0.06, d));
    float a = atan(q.y, q.x);
    float spiral = 0.5+0.5*sin(a*3.0 + d*22.0 - t*2.5);
    c += disk * palTDE(spiral*0.4 + 0.1) * (1.3 + 0.6*spiral);
    // Event horizon (dark disk)
    c *= smoothstep(0.06, 0.08, r);
    // Soft jet
    float jet = (1.0 - smoothstep(0.0, 0.08, abs(q.x))) * (1.0 - smoothstep(0.0, 0.6, abs(q.y)));
    c += jet*vec3(1.0,0.7,0.5)*0.3;
  }
  return c;
}

vec3 actResearch(vec2 uv, float p){
  vec2 q = uv;
  float t = uTime;
  vec3 col = vec3(0.006, 0.009, 0.022);
  col += stars(uv*2.0, 250., 0.9)*0.35;

  // Subtle global tilt
  q = rot(0.05*sin(t*0.2)) * q;

  // 2×2 grid covers roughly [-0.7..0.7] x [-0.45..0.45]
  vec2 grid = q * vec2(1.6, 2.2);
  vec2 cell = floor(grid + vec2(1.0, 1.0));
  vec2 local = fract(grid + vec2(1.0,1.0)) * 2.0 - 1.0;

  if(cell.x>=0.0 && cell.x<=1.0 && cell.y>=0.0 && cell.y<=1.0){
    int k = int(cell.x + cell.y*2.0);
    // Highlight: a sweeping focus moves through cells as progress advances
    float focusIdx = mod(floor(p*4.0 + t*0.15), 4.0);
    float focus = step(0.5, 1.0 - abs(float(k)-focusIdx));
    float boost = mix(0.55, 1.4, focus);
    col += transientCell(local*0.8, k, p) * boost;
    // Cell borders
    float bd = min(min(local.x+1.0, 1.0-local.x), min(local.y+1.0, 1.0-local.y));
    col += smoothstep(0.0, 0.02, bd) > 0.0 ? vec3(0.0) : vec3(0.10,0.18,0.30)*0.6;
  }

  return col;
}

// =============================================================
// ACT 3 — CV: relativistic light cone with year ticks
// =============================================================
vec3 actLightCone(vec2 uv, float p){
  vec2 q = uv;
  float t = uTime;
  vec3 col = vec3(0.006, 0.010, 0.025);
  col += stars(uv*1.8, 280., 0.9)*0.4;

  // Cone perspective: y is "time" axis, |x| = r grows linearly with y
  // Future cone above (y>0), past below — we draw an upward cone
  float coneSlope = 0.85;
  float dist = abs(q.x) - q.y*coneSlope;
  // Inside cone
  float inside = smoothstep(0.01, -0.01, dist);

  // Cone edges glow
  float edge = exp(-abs(dist)*60.0);
  col += edge * vec3(0.45, 0.75, 1.0) * 0.65;

  // Year rings — expanding from origin
  // Total years to display: 12 (from 2012 onwards)
  for(int i=0;i<12;i++){
    float fi = float(i);
    float ringT = fi*0.085;
    float ringR = ringT;
    float ringX = abs(q.x);
    float ringY = q.y;
    // Ring at y=ringT, half-width = ringT * coneSlope
    float maxX = ringT * coneSlope;
    float d = abs(ringY - ringT) + smoothstep(maxX, maxX+0.01, ringX)*1.0;
    float litAt = (fi+1.0)/12.0;
    float lit = smoothstep(litAt - 0.05, litAt, p);
    float ring = smoothstep(0.006, 0.0, d) * lit;
    col += ring * mix(vec3(0.4, 0.6, 1.0), vec3(1.0, 0.85, 0.5), lit) * 0.9;
    // Bright tick markers at the ends
    float tick = smoothstep(0.012, 0.0, abs(ringY-ringT)) * smoothstep(0.012, 0.0, abs(ringX-maxX));
    col += tick * vec3(1.0, 0.9, 0.6) * lit * 1.6;
  }

  // Light cone interior wash
  col += inside * vec3(0.06, 0.10, 0.22) * 0.6;

  // Photon paths shooting outward along the cone edges
  float photonY = mod(t*0.25, 1.2) - 0.1;
  float photonX = photonY * coneSlope;
  float ph1 = exp(-pow((q.x - photonX)*40.0,2.0) - pow((q.y - photonY)*40.0,2.0));
  float ph2 = exp(-pow((q.x + photonX)*40.0,2.0) - pow((q.y - photonY)*40.0,2.0));
  col += (ph1+ph2) * vec3(1.0, 0.9, 0.7) * 1.2;

  return col;
}

// =============================================================
// ACT 4 — PUBLICATIONS: 3D citation network
// =============================================================
vec3 actCitations(vec2 uv, float p){
  vec2 q = uv;
  float t = uTime;
  vec3 col = vec3(0.006, 0.010, 0.025);
  col += stars(uv*2.0, 260., 0.8)*0.3;

  // Cluster of nodes — pseudo-3D projection
  const int N = 28;
  float yaw = t*0.12 + p*0.6;
  float pitch = 0.25 + 0.10*sin(t*0.08);
  vec3 lightDir = normalize(vec3(0.6,0.4,0.8));

  for(int i=0;i<N;i++){
    float fi = float(i);
    // Distribute on a fibonacci-ish 3D shell
    float ph = fi * 2.39996;
    float yy = 1.0 - (fi/float(N-1))*2.0;
    float rad = sqrt(1.0 - yy*yy);
    vec3 P = vec3(cos(ph)*rad, yy, sin(ph)*rad);
    // Vary radii
    float age = hash11(fi*0.123);
    P *= mix(0.35, 0.85, age);

    // Rotate Y, then tilt
    float cy = cos(yaw), sy = sin(yaw);
    float cp = cos(pitch), sp = sin(pitch);
    vec3 Q = vec3(P.x*cy - P.z*sy, P.y, P.x*sy + P.z*cy);
    vec3 R = vec3(Q.x, Q.y*cp - Q.z*sp, Q.y*sp + Q.z*cp);

    // Project — z-depth used for fade and size
    float depth = 0.5 + R.z*0.5;
    vec2 sp2 = R.xy * 0.55;
    float d = length(q - sp2);
    float size = mix(0.018, 0.005, depth);
    float core = smoothstep(size, 0.0, d) * (0.6 + 0.4*age);
    float glow = exp(-d*40.0*(1.0-depth*0.3)) * 0.45 * (0.4 + 0.6*age);

    vec3 c = mix(vec3(0.55,0.75,1.0), vec3(1.0,0.85,0.55), age) * (0.6 + 0.6*depth);
    // Twinkle reveal — show progressively as p advances
    float reveal = smoothstep((fi/float(N))*0.7, (fi/float(N))*0.7+0.1, p+0.15);
    col += (core + glow) * c * reveal;
  }

  // Edges — connect nearby pairs in screen space
  for(int i=0;i<14;i++){
    float fi = float(i);
    float ph1 = fi * 1.7 + yaw;
    float ph2 = fi * 1.7 + yaw + 1.3;
    float r1 = 0.42 + 0.18*hash11(fi);
    float r2 = 0.42 + 0.18*hash11(fi+7.0);
    vec2 a = vec2(cos(ph1)*r1, sin(ph1)*r1*0.6);
    vec2 b = vec2(cos(ph2)*r2, sin(ph2)*r2*0.6);
    vec2 d = b-a;
    float h = clamp(dot(q-a,d)/dot(d,d), 0., 1.);
    float lineD = length((q-a) - d*h);
    float line = smoothstep(0.003, 0.0, lineD) * 0.18 * smoothstep(fi*0.05, fi*0.05+0.1, p);
    col += line * vec3(0.45, 0.65, 0.95);
  }

  // Subtle radial vignette
  col *= 1.0 - 0.35*pow(length(uv), 2.0);

  return col;
}

// =============================================================
// ACT 5 — CONTACT: gravitational wave chirp + warped grid
// =============================================================
vec3 actGravitationalWave(vec2 uv, float p){
  vec2 q = uv;
  float t = uTime;
  vec3 col = vec3(0.006, 0.010, 0.025);
  col += stars(uv*2.0, 240., 0.85)*0.35;

  // Two compact objects spiral inward — chirp time
  float chirp = pow(1.0 - clamp(p*0.95 + 0.05, 0.0, 1.0), 1.3);
  float omega = mix(2.0, 28.0, 1.0-chirp);
  float sep   = mix(0.05, 0.32, chirp);
  vec2 a = vec2(cos(t*omega), sin(t*omega))*sep;
  vec2 b = -a;
  float coal = smoothstep(0.06, 0.0, sep); // 1 when merged

  // Warped spacetime grid
  vec2 gp = q*8.0;
  float pull1 = 0.55 / max(length(q-a)*8.0, 0.6);
  float pull2 = 0.55 / max(length(q-b)*8.0, 0.6);
  gp -= (q-a)*pull1*0.4;
  gp -= (q-b)*pull2*0.4;
  vec2 grid = abs(fract(gp)-0.5);
  float gline = smoothstep(0.06, 0.0, min(grid.x, grid.y));
  col += gline * vec3(0.20,0.32,0.55) * 0.55;

  // The compact objects themselves
  float da = length(q-a), db = length(q-b);
  col += exp(-da*38.0)*vec3(0.9, 0.95, 1.1) * 1.3;
  col += exp(-db*38.0)*vec3(1.0, 0.85, 0.95) * 1.3;

  // Chirp ripples — outgoing waves after coalescence
  float ringPhase = mod((length(q) - (1.0-chirp)*1.2 - t*0.6)*5.0, 1.0);
  float ring = pow(0.5+0.5*sin(ringPhase*TAU), 8.0);
  ring *= smoothstep(0.0, 0.35, coal);
  col += ring * vec3(0.55, 0.85, 1.0) * 0.6 * (1.0 - smoothstep(0.0, 1.4, length(q)));

  // Merger flash
  float flash = pow(coal, 4.0) * exp(-length(q)*3.5);
  col += flash * vec3(1.0, 1.0, 0.95) * 2.0;

  return col;
}

// =============================================================
// MAIN — pick the act, light blending at boundaries
// =============================================================
vec3 dispatchAct(int idx, vec2 uv, float p){
  if(idx==0) return actBirth(uv, p);
  if(idx==1) return actMainSequence(uv, p);
  if(idx==2) return actResearch(uv, p);
  if(idx==3) return actLightCone(uv, p);
  if(idx==4) return actCitations(uv, p);
  return actGravitationalWave(uv, p);
}

void main(){
  vec2 fc = gl_FragCoord.xy / uResolution.xy;
  vec2 uv = (fc - 0.5) * vec2(uResolution.x/uResolution.y, 1.0);

  float aIdx = clamp(uActIndex, 0.0, max(uActCount - 0.001, 0.0));
  int   ai   = int(floor(aIdx));
  float p    = fract(aIdx);

  vec3 col;
  if(uReduced > 0.5){
    // Static fallback — just a calm starfield with the act's dominant color
    vec3 stars1 = vec3(stars(uv*2.0, 220., 1.0))*0.6;
    vec3 base = vec3(0.01, 0.02, 0.05);
    col = base + stars1;
  } else {
    col = dispatchAct(ai, uv, p);
    // Cross-fade window into next act (last 8% of section)
    if(p > 0.92 && ai+1 < int(uActCount)){
      float blend = (p - 0.92) / 0.08;
      vec3 nxt = dispatchAct(ai+1, uv, 0.0);
      col = mix(col, nxt, blend*0.55);
    }
  }

  // Subtle vignette
  col *= 1.0 - 0.25 * pow(length(uv*vec2(0.9,1.0)), 2.5);

  // Tonemap — Reinhard
  col = col / (1.0 + col);
  // Gamma
  col = pow(col, vec3(0.85));

  outColor = vec4(col, 1.0);
}
`;

export const MAIN_ACTS = [
  { selector: '#hero',         name: 'birth' },
  { selector: '#about',        name: 'main-sequence' },
  { selector: '#research',     name: 'transients' },
  { selector: '#cv',           name: 'light-cone' },
  { selector: '#publications', name: 'citations' },
  { selector: '#contact',      name: 'gravitational-wave' },
];
