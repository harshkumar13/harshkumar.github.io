import { COSMIC_LIB } from './cosmic-engine.js';

export const TDE_FRAGMENT = COSMIC_LIB + `

// Act 0 — Stellar orbit: star on a parabolic/eccentric orbit around a SMBH
// Act 1 — Tidal stretching: at periastron the star is stretched into spaghetti
// Act 2 — Debris stream: half-bound, half-ejected debris falls back
// Act 3 — Accretion disk: hot disk forms; BH "switches on"
// Act 4 — Multi-band emission + jet (optical/UV/X-ray + occasional jet)

vec3 drawBH(vec2 uv, float horiz, float diskInner, float diskOuter, float tilt, float bright){
  vec3 col = vec3(0.0);
  // Event horizon — dark disk
  float r = length(uv);
  // Accretion disk in ellipse (tilt = y compress factor)
  vec2 dp = uv;
  dp.y /= max(tilt, 0.04);
  float dr = length(dp);
  float disk = smoothstep(diskOuter, diskOuter-0.02, dr) * (1.0 - smoothstep(diskInner+0.02, diskInner, dr));
  // Angular swirling
  float a = atan(uv.y, uv.x);
  float swirl = 0.5+0.5*sin(a*3.0 + dr*30.0 - uTime*2.5);
  col += disk * palTDE(swirl*0.4 + 0.1) * (1.2 + 0.7*swirl) * bright;
  // Event horizon dark
  col *= smoothstep(horiz, horiz+0.01, r);
  return col;
}

vec3 actOrbit(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 270., 0.9) * 0.35;
  float r = length(uv);
  // SMBH (no disk yet)
  col *= smoothstep(0.05, 0.06, r);
  // Soft accretion glow (pre-existing low-rate)
  col += exp(-r*r*100.0)*vec3(0.7,0.6,0.5)*0.7;
  // Orbiting star — eccentric
  float t = uTime*0.4 + p*4.0;
  float ecc = 0.65;
  float ph = t;
  float starR_orbit = mix(0.5, 0.15, p);
  vec2 starPos = vec2(cos(ph)*starR_orbit*(1.0+ecc*cos(ph)), sin(ph)*starR_orbit*0.7);
  float d = length(uv-starPos);
  col += exp(-d*40.0) * vec3(1.0, 0.9, 0.6) * 1.5;
  // Star trail
  for(int i=1;i<8;i++){
    float fi=float(i);
    float pt = ph - fi*0.08;
    vec2 tp = vec2(cos(pt)*starR_orbit*(1.0+ecc*cos(pt)), sin(pt)*starR_orbit*0.7);
    float td = length(uv-tp);
    col += exp(-td*55.0)*vec3(1.0,0.85,0.55)*0.55*(1.0-fi/8.0);
  }
  return col;
}

vec3 actTidalStretch(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 260., 0.9) * 0.3;
  float r = length(uv);
  // BH
  col *= smoothstep(0.05, 0.06, r);
  col += exp(-r*r*120.0)*vec3(0.85,0.7,0.55)*0.95;
  // Stretched star — elongating ellipse near BH
  float stretchX = mix(0.04, 0.30, p);
  float stretchY = mix(0.04, 0.02, p);
  vec2 starPos = vec2(0.20 - 0.10*p, 0.0);
  vec2 dp = (uv - starPos) / vec2(stretchX, stretchY);
  float strecthD = length(dp);
  float starSh = smoothstep(1.2, 0.0, strecthD);
  vec3 starCol = blackbody(mix(5500., 6800., p));
  col += starSh * starCol * 1.2;
  // Tidal hint — small disturbance toward BH
  float trail = exp(-pow((uv.x-starPos.x*0.5)*8.0, 2.0)) * exp(-pow(uv.y*15.0,2.0)) * smoothstep(0.5,1.0,p);
  col += trail*vec3(1.0,0.7,0.4)*0.7;
  return col;
}

vec3 actStream(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 250., 0.85) * 0.3;
  float r = length(uv);
  // BH + faint disk forming
  col += drawBH(uv, 0.05, 0.08, 0.30, mix(0.7, 0.32, p), mix(0.3, 0.85, p));
  // Returning debris stream — bright curl
  for(int i=0;i<40;i++){
    float fi=float(i);
    float ang = fi*0.35 + uTime*0.4 - p*3.0;
    float rad = 0.35 - fi*0.006 + 0.05*sin(uTime*0.6 + fi*0.7);
    vec2 sp = vec2(cos(ang)*rad, sin(ang)*rad*0.35);
    float dd = length(uv - sp);
    float weight = exp(-pow(fi - p*30.0,2.0)*0.08);
    col += exp(-dd*55.0) * vec3(1.0, 0.7, 0.45) * 0.85 * weight;
  }
  // Ejected debris (going outward)
  float ejX = uv.x + 0.6 - p*0.4;
  float ejY = uv.y * 5.0;
  float ej = exp(-pow(ejX, 2.0)*8.0 - pow(ejY,2.0));
  col += ej * vec3(0.95, 0.55, 0.3) * 0.55;
  return col;
}

vec3 actDisk(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 240., 0.85) * 0.3;
  // Mature, bright accretion disk
  col += drawBH(uv, 0.05, 0.07, 0.40 + 0.05*p, 0.30, 1.4);
  // Inner disk hot UV emission
  vec2 dp = uv;
  dp.y /= 0.30;
  float dr = length(dp);
  float hot = exp(-pow((dr-0.10)/0.06, 2.0));
  col += hot * vec3(0.6, 0.85, 1.4) * 1.5;
  // Outer wind
  float wind = exp(-pow((length(uv)-0.55)/0.25, 2.0));
  col += wind * vec3(1.0, 0.7, 0.45) * 0.6;
  return col;
}

vec3 actJet(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 230., 0.85) * 0.3;
  col += drawBH(uv, 0.05, 0.07, 0.42, 0.30, 1.25);
  // Relativistic jet (rare TDEs)
  float jetX = abs(uv.x);
  float jet = (1.0 - smoothstep(0.04, 0.10, jetX)) * (1.0 - smoothstep(0.6, 0.95, abs(uv.y))) * smoothstep(0.0, 0.4, p);
  // Knots in jet
  float knot = 0.5+0.5*sin(abs(uv.y)*20.0 - uTime*5.0);
  jet *= 0.55 + 0.45*knot;
  col += jet * vec3(0.7, 1.0, 1.4) * 1.6;
  // Multi-band emission glow
  float glow = exp(-length(uv)*2.0);
  col += glow * vec3(0.55, 0.85, 1.15) * 0.45 * smoothstep(0.0,0.6,p);
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
  float aIdx = clamp(uActIndex, 0.0, max(uActCount - 0.001, 0.0));
  int   ai   = int(floor(aIdx));
  float p    = fract(aIdx);
  vec3 col;
  if(uReduced > 0.5){
    col = vec3(0.01,0.02,0.05) + stars(uv*2.0, 220., 1.0)*0.6;
  } else {
    col = dispatch(ai, uv, p);
    if(p > 0.92 && ai+1 < int(uActCount)){
      float b = (p - 0.92) / 0.08;
      col = mix(col, dispatch(ai+1, uv, 0.0), b*0.5);
    }
  }
  col *= 1.0 - 0.25 * pow(length(uv*vec2(0.9,1.0)), 2.5);
  col = col / (1.0 + col);
  col = pow(col, vec3(0.85));
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
