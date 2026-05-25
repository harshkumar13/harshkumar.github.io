import { COSMIC_LIB } from './cosmic-engine.js';

export const GRB_FRAGMENT = COSMIC_LIB + `

// Act 0 — Massive progenitor (Wolf-Rayet-like): rotating bright star with stellar wind
vec3 actProgenitor(vec2 uv, float p){
  vec3 col = vec3(0.005,0.008,0.020);
  col += stars(uv*2.0, 280., 0.9) * 0.4;

  vec2 q = uv;
  float r = length(q);
  float starR = 0.16;
  float limb = smoothstep(starR, starR*0.55, r);

  // Surface — turbulent fbm with rotation
  vec2 sph = vec2(atan(q.y, q.x), r);
  float surf = fbm(vec2(cos(sph.x)*3.0, sin(sph.x)*3.0)*4.0 + vec2(uTime*0.2));
  vec3 phot = blackbody(40000.) * 0.8; // hot WR star
  col = mix(col, phot * (0.55 + 0.55*surf), limb);

  // Stellar wind — spiral streaks outward
  float ang = atan(q.y, q.x);
  for(int i=0;i<4;i++){
    float fi=float(i);
    float ph = ang*1.5 + fi*1.6 + uTime*0.25 + r*4.0;
    float streak = pow(0.5+0.5*sin(ph), 8.0) * exp(-pow((r-0.25-fi*0.04)*8.0,2.0));
    col += streak * vec3(0.4,0.6,0.95) * 0.5 * (1.0-limb);
  }

  // Soft corona
  float corona = exp(-pow((r-starR)/0.35,2.0)*4.0) * (1.0-limb);
  col += corona * vec3(0.6,0.75,1.0) * 0.6;

  return col;
}

// Act 1 — Core collapse: surface dims, central core implodes, shock starts
vec3 actCoreCollapse(vec2 uv, float p){
  vec3 col = vec3(0.005,0.008,0.020);
  col += stars(uv*2.0, 260., 0.9) * 0.35;
  vec2 q = uv;
  float r = length(q);

  // Surface dimming
  float starR = mix(0.16, 0.30, p); // star expands as outer layers loosen
  float dim = mix(1.0, 0.30, p);
  float limb = smoothstep(starR, starR*0.55, r);
  vec2 sph = vec2(atan(q.y,q.x), r);
  float surf = fbm(vec2(cos(sph.x)*3.0, sin(sph.x)*3.0)*4.0 + vec2(uTime*0.15));
  vec3 phot = blackbody(mix(40000., 18000., p));
  col = mix(col, phot * (0.45 + 0.5*surf) * dim, limb);

  // Imploding core — dark center with shock ring expanding
  float coreR = mix(0.0, 0.08, smoothstep(0.0,0.7,p));
  float core = smoothstep(coreR+0.01, coreR-0.01, r);
  col = mix(col, vec3(0.0), core);

  // Shock ring
  float shockR = mix(0.0, 0.22, p);
  float shock = smoothstep(0.015, 0.0, abs(r-shockR)) * smoothstep(0.0,0.3,p);
  col += shock * vec3(1.0,0.85,0.55) * 1.6;

  // Neutrino-driven flash at end
  float ign = smoothstep(0.75, 0.98, p);
  col += ign * exp(-r*5.0) * vec3(0.5,0.8,1.2) * 1.8;
  return col;
}

// Act 2 — Bipolar jet launch: relativistic jets punch through envelope
vec3 actJetLaunch(vec2 uv, float p){
  vec3 col = vec3(0.005,0.008,0.020);
  col += stars(uv*2.0, 250., 0.85) * 0.35;
  vec2 q = uv;
  float r = length(q);

  // Lingering envelope as torus-shape (collapsar)
  float env = exp(-r*4.0) * 0.4;
  col += env * palGRB(0.3) * 0.6;

  // Bipolar jets — narrow, fast, blue-violet
  float jetLen = mix(0.0, 0.95, p);
  float jetX = abs(q.x);
  float jetWidth = mix(0.10, 0.04, p); // jet narrows as it accelerates
  float withinJet = smoothstep(jetWidth, jetWidth*0.5, jetX);
  float yProf = smoothstep(jetLen, jetLen-0.04, abs(q.y));
  float jet = withinJet * yProf;

  // Knots in jet — internal-shock precursor
  float knot = 0.5 + 0.5*sin(abs(q.y)*22.0 - uTime*6.0);
  jet *= 0.55 + 0.45*knot;

  col += jet * vec3(0.7, 0.9, 1.3) * 1.4;
  col += jet * vec3(0.95, 0.6, 0.85) * 0.3; // edge tint

  // Cocoon — diffuse glow around jet base
  float cocoon = exp(-r*7.0) * smoothstep(0.0, 0.4, p);
  col += cocoon * vec3(1.0, 0.7, 0.4) * 1.2;

  return col;
}

// Act 3 — Prompt emission: chaotic internal shocks, gamma-ray flash
vec3 actPromptEmission(vec2 uv, float p){
  vec3 col = vec3(0.005,0.008,0.020);
  col += stars(uv*2.0, 240., 0.85) * 0.3;
  vec2 q = uv;
  float r = length(q);

  // Wide jets
  float jetX = abs(q.x);
  float jetWidth = 0.18;
  float withinJet = smoothstep(jetWidth, jetWidth*0.4, jetX) * smoothstep(1.0, 0.6, abs(q.y));

  // Internal shocks — turbulent variability
  float chaos = fbm(vec2(q.x*10.0, q.y*6.0 - uTime*3.0));
  chaos += 0.5 * fbm(vec2(q.x*22.0, q.y*16.0 - uTime*5.5));
  float flash = pow(chaos, 2.5);
  col += withinJet * flash * vec3(1.2, 1.0, 0.7) * 1.4;

  // Gamma-ray flash — bright pulses at random phases
  float pulseT = mod(uTime*1.2 + p*8.0, 4.0);
  float pulse = exp(-pow((pulseT-2.0)*4.0,2.0));
  col += withinJet * pulse * vec3(1.6, 1.3, 1.0) * 0.8;

  // Central engine glow
  col += exp(-r*8.0) * vec3(1.0,0.9,0.6) * 1.8;
  // Soft halo
  col += exp(-r*2.5)*0.15 * palGRB(0.5);

  return col;
}

// Act 4 — Afterglow: forward shock with ISM, multi-wavelength bands fade with time
vec3 actAfterglow(vec2 uv, float p){
  vec3 col = vec3(0.005,0.008,0.020);
  col += stars(uv*2.0, 230., 0.85) * 0.35;
  vec2 q = uv;
  float r = length(q);

  // Expanding shock surface
  float shockR = mix(0.18, 1.05, p);
  float thickness = 0.06;
  float shock = exp(-pow((r-shockR)/thickness, 2.0));
  // Color cycles X-ray (blue) → optical (white) → IR (red) as shock cools
  float coolPhase = p;
  vec3 shockCol = mix(vec3(0.4,0.6,1.2), vec3(1.0,0.9,0.7), smoothstep(0.0,0.5,coolPhase));
  shockCol = mix(shockCol, vec3(1.0,0.55,0.3), smoothstep(0.5,1.0,coolPhase));
  col += shock * shockCol * (1.4 - 0.7*coolPhase);

  // Fading central engine
  col += exp(-r*6.0) * vec3(0.9, 0.85, 0.7) * (0.7 - 0.6*p);

  // Jet break — sharp narrowing in later afterglow
  float jetBreak = smoothstep(0.6, 0.9, p);
  float jetSig = (1.0 - smoothstep(0.0, 0.30, abs(q.x))) * exp(-pow(q.y, 2.0)*0.5);
  col += jetBreak * jetSig * vec3(0.6,0.8,1.1) * 0.6;

  // Late-time radio (diffuse all-around)
  float radio = smoothstep(0.7, 1.0, p) * exp(-r*1.4);
  col += radio * vec3(0.4, 0.35, 0.55) * 0.6;
  return col;
}

vec3 dispatch(int ai, vec2 uv, float p){
  if(ai==0) return actProgenitor(uv, p);
  if(ai==1) return actCoreCollapse(uv, p);
  if(ai==2) return actJetLaunch(uv, p);
  if(ai==3) return actPromptEmission(uv, p);
  return actAfterglow(uv, p);
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

export const GRB_ACTS = [
  { selector: '#act-progenitor', name: 'progenitor' },
  { selector: '#act-collapse',   name: 'core-collapse' },
  { selector: '#act-jet',        name: 'jet-launch' },
  { selector: '#act-prompt',     name: 'prompt' },
  { selector: '#act-afterglow',  name: 'afterglow' },
];
