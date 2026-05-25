import { COSMIC_LIB } from './cosmic-engine.js';

export const KN_FRAGMENT = COSMIC_LIB + `

// Act 0 — Binary NS inspiral: wide orbit, slow chirp, faint GW ripples
// Act 1 — Final orbit: orbit tightens, chirp ramps, frequency rises
// Act 2 — Merger flash: white flash, prompt EM
// Act 3 — Blue kilonova: lanthanide-poor wind ejecta
// Act 4 — Red kilonova: lanthanide-rich r-process tidal ejecta

vec3 nsBinary(vec2 uv, float p, float sepStart, float sepEnd, float omegaStart, float omegaEnd){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 260., 0.9) * 0.35;
  float t = uTime;
  // Use slower-than-real coords just for visualization
  float sep   = mix(sepStart, sepEnd, p);
  float omega = mix(omegaStart, omegaEnd, p);
  vec2 a = vec2(cos(t*omega), sin(t*omega))*sep;
  vec2 b = -a;
  // NS dots
  float da = length(uv-a), db = length(uv-b);
  col += exp(-da*36.0)*vec3(0.95, 0.95, 1.05) * 1.4;
  col += exp(-db*36.0)*vec3(1.0, 0.85, 0.95) * 1.4;
  // GW ripples — phase locked to orbit
  float angle = atan(uv.y, uv.x);
  float ringPhase = length(uv)*8.0 - t*omega*2.0 + sin(angle*4.0)*0.5;
  float ring = pow(0.5+0.5*sin(ringPhase), 4.0);
  ring *= exp(-length(uv)*1.2);
  col += ring * vec3(0.35, 0.55, 0.85) * 0.6 * mix(0.3,1.0,p);
  return col;
}

vec3 actInspiral(vec2 uv, float p){
  return nsBinary(uv, p, 0.36, 0.20, 1.8, 5.0);
}

vec3 actFinalOrbit(vec2 uv, float p){
  return nsBinary(uv, p, 0.20, 0.05, 5.0, 22.0);
}

vec3 actMerger(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 260., 0.9) * 0.3;
  float r = length(uv);
  // Bright merger flash — fades over the act
  float flash = exp(-r*r*40.0) * (1.0 - smoothstep(0.0, 0.7, p));
  col += flash * vec3(1.4, 1.3, 1.1) * 3.0;
  // Outgoing shock
  float shockR = mix(0.0, 0.55, p);
  float shockTh = 0.04 + 0.05*p;
  float shock = exp(-pow((r-shockR)/shockTh, 2.0));
  col += shock * vec3(1.2, 0.95, 0.75) * 1.6;
  // Tidal ejecta — equatorial fan
  float yProf = exp(-pow(uv.y*7.0,2.0));
  float fan = smoothstep(shockR-0.05, shockR+0.15, abs(uv.x)) * (1.0 - smoothstep(shockR+0.2, shockR+0.55, abs(uv.x)));
  col += fan*yProf*vec3(1.0,0.45,0.3) * smoothstep(0.4,1.0,p) * 1.2;
  // Soft afterglow
  col += exp(-r*3.0) * 0.18 * palKilonova(p*0.4);
  return col;
}

vec3 actBlueKilonova(vec2 uv, float p){
  vec3 col = vec3(0.006, 0.010, 0.024);
  col += stars(uv*2.0, 250., 0.85) * 0.3;
  float r = length(uv);
  // Wind ejecta: blue, polar, fast
  float polar = exp(-pow(uv.x*2.5, 2.0));
  float radial = exp(-pow((r-0.30 - 0.15*p)/0.18, 2.0));
  col += polar * radial * vec3(0.55, 0.85, 1.3) * 1.6;
  // Central NS / hypermassive remnant
  col += exp(-r*r*60.0)*vec3(1.2,1.1,1.0)*1.4;
  // Faint outer expansion
  float outer = exp(-pow((r-0.45-0.20*p)/0.22, 2.0));
  col += outer * vec3(0.45, 0.70, 1.05) * 0.55;
  return col;
}

vec3 actRedKilonova(vec2 uv, float p){
  vec3 col = vec3(0.008, 0.011, 0.022);
  col += stars(uv*2.0, 240., 0.85) * 0.3;
  float r = length(uv);
  // Equatorial dynamical ejecta — red r-process
  float eq = exp(-pow(uv.y*3.0, 2.0));
  float radial = exp(-pow((r-0.42 - 0.20*p)/0.22, 2.0));
  col += eq * radial * vec3(1.2, 0.45, 0.30) * 1.6;
  // Lanthanide opacity bands
  float bands = 0.5 + 0.5*sin(r*22.0 - uTime*0.4);
  col *= 0.7 + 0.6*bands;
  // Persisting blue polar component (now dimmer)
  float polar = exp(-pow(uv.x*2.5, 2.0));
  float polarBand = exp(-pow((r-0.35)/0.20, 2.0));
  col += polar * polarBand * vec3(0.35, 0.55, 0.95) * 0.55 * (1.0-p);
  // Late-time central glow
  col += exp(-r*r*40.0)*vec3(0.95,0.7,0.55)*0.55;
  return col;
}

vec3 dispatch(int ai, vec2 uv, float p){
  if(ai==0) return actInspiral(uv,p);
  if(ai==1) return actFinalOrbit(uv,p);
  if(ai==2) return actMerger(uv,p);
  if(ai==3) return actBlueKilonova(uv,p);
  return actRedKilonova(uv,p);
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

export const KN_ACTS = [
  { selector: '#act-inspiral',    name: 'inspiral' },
  { selector: '#act-finalorbit',  name: 'final-orbit' },
  { selector: '#act-merger',      name: 'merger' },
  { selector: '#act-bluekn',      name: 'blue-kilonova' },
  { selector: '#act-redkn',       name: 'red-kilonova' },
];
