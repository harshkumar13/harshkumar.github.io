import { COSMIC_LIB } from './cosmic-engine.js';

export const TDE_FRAGMENT = COSMIC_LIB + `

// Local warm-palette accretion disk for the TDE narrative.
// Keeps the photon-ring / Doppler / spiral physics but constrains color
// to the orange→yellow→white-hot family (no blue).
vec3 warmDisk(vec2 uv, float tilt, float spin, float rs, float t){
  float rIn  = mix(3.0, 1.2, spin) * rs;
  float rOut = 30.0 * rs;
  float rPh  = 1.5 * rs;
  float horizon = mix(2.0, 1.05, spin) * rs;
  float r = length(uv);

  vec2 dp = uv;
  dp.y /= max(1.0 - tilt*0.85, 0.10);
  float dr = length(dp);
  float ang = atan(dp.y, dp.x);

  float inMask  = smoothstep(rIn*0.95, rIn*1.05, dr);
  float outMask = 1.0 - smoothstep(rOut*0.6, rOut, dr);
  float radial  = inMask * outMask * pow(rs/max(dr, rs*0.5), 0.75);
  float spiral = 0.6 + 0.4*sin(ang*2.0 + dr*4.0/rs + t*1.4);
  float turb   = warpFbm(vec2(ang*2.5, dr*1.5/rs) + vec2(t*0.4, 0.0), t);
  float emiss  = radial * (0.6 + 0.7*spiral) * (0.7 + 0.6*turb);

  // Doppler brightness boost only (no color shift) — keeps warm palette.
  float beta = 0.40 * (1.0 - tilt*0.3);
  float dop  = 1.0 / max(1.0 - beta * cos(ang - PI*0.5), 0.2);
  emiss *= pow(dop, 3.0);

  // Warm 3-stop palette: deep orange → yellow → white-hot
  vec3 cool = vec3(0.85, 0.30, 0.10);   // outer disk, deep orange
  vec3 mid  = vec3(1.05, 0.65, 0.20);   // mid disk, amber
  vec3 hot  = vec3(1.20, 1.00, 0.65);   // inner / hottest, yellow-white
  float warmT = clamp(emiss*0.5 + (1.0 - smoothstep(rIn, rOut*0.4, dr)), 0.0, 1.0);
  vec3 col = mix(cool, mid, smoothstep(0.0, 0.5, warmT));
  col      = mix(col,  hot, smoothstep(0.5, 1.0, warmT));
  col *= emiss * 1.6;

  // Inner-edge hot pop
  col += smoothstep(rIn*1.6, rIn*0.95, dr) * smoothstep(rIn*0.85, rIn, dr) * vec3(1.30, 0.95, 0.55) * 1.4;
  // Photon ring (warm)
  float photonRing = exp(-pow((r-rPh)/(rs*0.07), 2.0)) * (0.6 - tilt*0.3);
  col += photonRing * vec3(1.20, 0.95, 0.55) * 2.4;
  // Event horizon (pure black)
  col *= smoothstep(horizon*0.92, horizon*1.08, r);
  return col;
}

// Act 0 — Stellar orbit: a star approaches a quiescent SMBH
vec3 actOrbit(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  // Background grav-lensing
  vec2 lensed = uv;
  float lr = length(uv);
  float defl = 0.05 / max(lr, 0.06);
  lensed = uv - normalize(uv)*defl*0.6;
  col = mix(col, deepSky(lensed), smoothstep(0.5, 0.05, lr));

  // Quiescent SMBH — dark sphere + warm photon ring
  float horizonR = 0.06;
  float ringR = 0.085;
  col *= smoothstep(horizonR*0.9, horizonR*1.1, lr);
  col += exp(-pow((lr-ringR)/0.005, 2.0)) * vec3(1.10, 0.85, 0.45) * 1.0;

  // Eccentric orbit of the star (yellow)
  float ph = uTime*0.4 + p*4.0;
  float ecc = 0.65;
  float starOrbR = mix(0.55, 0.18, p);
  vec2 starPos = vec2(cos(ph)*starOrbR*(1.0+ecc*cos(ph)), sin(ph)*starOrbR*0.7);
  col += exp(-length(uv-starPos)*40.0) * vec3(1.05, 0.85, 0.50) * 1.7;
  col = hotGlow(col, uv, starPos, vec3(1.0,0.80,0.40)*1.2, 0.05);
  for(int i=1;i<10;i++){
    float fi = float(i);
    float pt = ph - fi*0.07;
    vec2 tp = vec2(cos(pt)*starOrbR*(1.0+ecc*cos(pt)), sin(pt)*starOrbR*0.7);
    col += exp(-length(uv-tp)*55.0) * vec3(1.05, 0.80, 0.45) * (0.65 - fi*0.06);
  }
  return col;
}

// Act 1 — Tidal stretching at periastron
vec3 actTidalStretch(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  // Forming low-rate disk (warm)
  col += warmDisk(uv, 0.50, 0.5, 0.040, t) * mix(0.20, 0.85, p);

  // Stretched star — elongated ellipse, warming as compressed
  float stretchX = mix(0.04, 0.30, p);
  float stretchY = mix(0.04, 0.020, p);
  vec2 starPos = vec2(0.22 - 0.10*p, 0.0);
  vec2 dp = (uv - starPos) / vec2(stretchX, stretchY);
  float strecthD = length(dp);
  float starSh = smoothstep(1.2, 0.0, strecthD);
  // Stay warm throughout — no blue
  vec3 starCol = mix(vec3(1.0, 0.75, 0.40), vec3(1.20, 0.95, 0.55), p);
  col += starSh * starCol * 1.4;

  // Tidal fingers pulled toward BH (warm)
  float tail = exp(-pow((uv.x - starPos.x*0.5)*7.0, 2.0)) * exp(-pow(uv.y*15.0,2.0)) * smoothstep(0.5,1.0,p);
  col += tail * vec3(1.10, 0.70, 0.30) * 0.85;
  return col;
}

// Act 2 — Debris stream, fallback, circularization
vec3 actStream(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  col += warmDisk(uv, 0.45, 0.55, 0.045, t) * mix(0.35, 1.0, p);

  // Returning fallback stream — warm glowing curl
  for(int i=0;i<48;i++){
    float fi = float(i);
    float ang = fi*0.32 + t*0.35 - p*2.2;
    float rad = 0.40 - fi*0.0055 + 0.04*sin(t*0.5 + fi*0.6);
    vec2 sp = vec2(cos(ang)*rad, sin(ang)*rad*0.32);
    float dd = length(uv - sp);
    float wt = exp(-pow(fi - p*40.0, 2.0)*0.05);
    col += exp(-dd*55.0) * vec3(1.10, 0.75, 0.40) * 1.0 * wt;
  }

  // Ejected debris (going outward)
  float ejX = uv.x + 0.6 - p*0.5;
  float ejY = uv.y * 6.0;
  float ej = exp(-pow(ejX, 2.0)*8.0 - pow(ejY, 2.0));
  col += ej * vec3(1.00, 0.60, 0.30) * 0.6;
  for(int j=0;j<5;j++){
    float fj=float(j);
    float ex = uv.x + 0.6 - p*0.5 + fj*0.07;
    float ey = uv.y * (6.0 + fj*1.5);
    col += exp(-pow(ex, 2.0)*12.0 - pow(ey, 2.0))*vec3(1.05, 0.60, 0.30)*0.20*(1.0-fj/5.0);
  }
  return col;
}

// Act 3 — Mature accretion disk (warm; viewer rotates around through scroll)
vec3 actDisk(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  float tilt = mix(0.65, 0.30, p);
  float spin = 0.70;
  col += warmDisk(uv, tilt, spin, 0.050 + 0.005*p, t);

  // Inner hot region — yellow-white instead of UV-blue
  vec2 dp = uv; dp.y /= max(1.0 - tilt*0.85, 0.10);
  float dr = length(dp);
  float innerHot = exp(-pow((dr-0.10)/0.05, 2.0));
  col += innerHot * vec3(1.25, 1.00, 0.60) * 1.7;

  // Outer wind — deep orange
  float wind = exp(-pow((length(uv)-0.50)/0.22, 2.0));
  col += wind * vec3(1.05, 0.60, 0.30) * 0.7;

  // Gravitational lensing flare (warm)
  float gl = exp(-pow((length(uv) - 0.18)/0.012, 2.0)) * (0.4 + 0.3*sin(t*0.3));
  col += gl * vec3(1.20, 0.85, 0.45) * 0.65;

  col = hotGlow(col, uv, vec2(0.0), vec3(1.0, 0.80, 0.45), 0.10);
  col += lensFlare(uv, vec2(0.0), vec3(1.10, 0.85, 0.45), 0.40);
  return col;
}

// Act 4 — Rare relativistic jet (warm gold, not blue)
vec3 actJet(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv) * 0.95;

  // Edge-on disk so the jet stands out
  col += warmDisk(uv, 0.78, 0.95, 0.050, t) * 0.95;

  // Bipolar jet — warm yellow/white-hot
  vec3 jetN = relJet(uv, vec2(0.0,  1.0), 1.10, 0.045, 25.0, vec3(1.15, 0.85, 0.45), t);
  vec3 jetS = relJet(uv, vec2(0.0, -1.0), 1.10, 0.045, 25.0, vec3(1.15, 0.85, 0.45), t);
  col += (jetN + jetS) * mix(0.6, 1.4, p);

  // Bow shock head
  float headY = 1.10;
  float bow = exp(-pow((abs(uv.y) - headY)/0.05, 2.0)) * smoothstep(0.18, 0.0, abs(uv.x));
  col += bow * vec3(1.20, 0.90, 0.45) * 1.0;

  // Central glow (warm)
  col += exp(-length(uv)*length(uv)*250.0) * vec3(1.20, 0.90, 0.55) * 2.4;
  col = hotGlow(col, uv, vec2(0.0), vec3(1.15, 0.85, 0.45), 0.12);
  col += lensFlare(uv, vec2(0.0), vec3(1.15, 0.85, 0.45), 0.55);
  return col;
}

vec3 dispatch(int ai, vec2 uv, float p){
  if(ai==0) return actOrbit(uv,p);
  if(ai==1) return actTidalStretch(uv,p);
  if(ai==2) return actStream(uv,p);
  if(ai==3) return actDisk(uv,p);
  return actJet(uv,p);
}

void main(){
  vec2 fc = gl_FragCoord.xy / uResolution.xy;
  vec2 uv = (fc - 0.5) * vec2(uResolution.x/uResolution.y, 1.0);
  uv += (uMouse - 0.5) * 0.012;
  float aIdx = clamp(uActIndex, 0.0, max(uActCount - 0.001, 0.0));
  int   ai   = int(floor(aIdx));
  float p    = fract(aIdx);
  vec3 col;
  if(uReduced > 0.5){
    col = deepSky(uv) * 0.9;
  } else {
    col = dispatch(ai, uv, p);
    if(p > 0.88 && ai+1 < int(uActCount)){
      float b = smoothstep(0.88, 1.0, p);
      col = mix(col, dispatch(ai+1, uv, 0.0), b*0.6);
    }
  }
  col *= 1.0 - 0.30 * pow(length(uv*vec2(0.9,1.0)), 2.4);
  float ca = length(uv) * 0.0024;
  vec2 dir = normalize(uv + 1e-5);
  vec3 caCol = vec3(dispatch(ai, uv - dir*ca, p).r, col.g, dispatch(ai, uv + dir*ca, p).b);
  col = mix(col, caCol, 0.12);
  col = col / (1.0 + col);
  col = pow(col, vec3(0.82));
  col += hash12(gl_FragCoord.xy + uTime*60.0)*0.012 - 0.006;
  outColor = vec4(col, 1.0);
}
`;

export const TDE_ACTS = [
  { selector: '#act-orbit',    name: 'orbit' },
  { selector: '#act-stretch',  name: 'stretch' },
  { selector: '#act-stream',   name: 'stream' },
  { selector: '#act-disk',     name: 'disk' },
  { selector: '#act-jet',      name: 'jet' },
];
