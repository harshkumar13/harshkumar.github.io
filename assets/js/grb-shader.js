import { COSMIC_LIB } from './cosmic-engine.js';

export const GRB_FRAGMENT = COSMIC_LIB + `

// Act 0 — Wolf-Rayet progenitor: hot, fast-rotating, strong stellar wind
vec3 actProgenitor(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  vec2 q = uv;
  float r = length(q);

  float starR = 0.16;
  float limb  = smoothstep(starR, starR*0.55, r);
  vec3 phot   = blackbody(45000.) * 0.85;

  // Granulation + magnetic structure on surface
  float lon = atan(q.y, q.x);
  float surf = fbm(vec2(cos(lon)*3.0, sin(lon)*3.0)*4.0 + vec2(t*0.18));
  surf += 0.5*fbm(vec2(cos(lon)*8.0, sin(lon)*8.0)*7.0 - vec2(t*0.3));
  col = mix(col, phot * (0.50 + 0.55*smoothstep(0.3,0.95,surf)), limb);

  // Parker-spiral stellar wind — outward spirals modulated by rotation
  for(int i=0;i<5;i++){
    float fi = float(i);
    float ph = lon*2.0 + fi*1.5 + t*0.5 + r*6.0;
    float streak = pow(0.5+0.5*sin(ph), 10.0);
    streak *= exp(-pow((r - 0.30 - fi*0.05)/0.04, 2.0));
    col += streak * mix(vec3(0.45, 0.70, 1.10), vec3(0.95, 0.60, 0.85), fi/5.0) * 0.85 * (1.0-limb);
  }

  // Wind bubble / ionization halo
  float halo = exp(-pow((r - starR)/0.40, 2.0)*3.5) * (1.0-limb);
  col += halo * vec3(0.55, 0.75, 1.10) * 0.85;
  col += lensFlare(q, vec2(0.0), vec3(0.65,0.80,1.20), 0.45);
  // Photons departing — short lens-flare streaks
  col += exp(-r*1.5)*0.10 * phot;
  return col;
}

// Act 1 — Core collapse: photosphere implodes, shock breakout
vec3 actCoreCollapse(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  vec2 q = uv;
  float r = length(q);

  // Expanding outer envelope (loosely bound material flying outward)
  float envR = mix(0.16, 0.50, p);
  float envTh = 0.10;
  float env = exp(-pow((r-envR)/envTh, 2.0));
  vec3 envCol = blackbody(mix(20000., 9000., p));
  col += env * envCol * (0.9 - 0.5*p);

  // Dark imploded core grows
  float coreR = mix(0.0, 0.10, smoothstep(0.0, 0.7, p));
  col *= smoothstep(coreR*0.95, coreR*1.05, r);

  // Shock ring expanding outward
  float shockR = mix(0.0, 0.32, p);
  float shock = exp(-pow((r-shockR)/0.025, 2.0));
  col += shock * vec3(1.4, 1.0, 0.6) * 1.8;

  // Neutrino-driven flash at end
  float ign = smoothstep(0.75, 0.98, p);
  col += ign * exp(-r*4.5) * vec3(0.55, 0.85, 1.30) * 2.4;
  col += lensFlare(q, vec2(0.0), vec3(0.7,0.9,1.3), ign*0.5);

  // Turbulent ejecta fingers
  float fingers = rfbm(vec2(atan(q.y,q.x)*4.0, r*8.0 + t*0.4));
  col *= 0.7 + 0.5*fingers;
  return col;
}

// Act 2 — Bipolar relativistic jets break through stellar envelope
vec3 actJetLaunch(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  vec2 q = uv;
  float r = length(q);

  // Collapsar envelope: the jet is still drilling through optically thick
  // stellar material, so the cocoon is broad and baryon-loaded while the
  // relativistic spine stays narrow along the rotation axis.
  vec2 cq = vec2(q.x*1.20, q.y*0.82);
  float env = exp(-pow(length(cq)/0.48, 2.0));
  float cavity = smoothstep(0.11, 0.028, abs(q.x)) * smoothstep(0.02, 0.65, abs(q.y));
  float turb = rfbm(vec2(atan(q.y,q.x)*3.0, r*8.0 - t*0.25));
  col += env * (0.55 + 0.45*turb) * vec3(0.95, 0.42, 0.18) * 0.55;
  col *= 1.0 - cavity * smoothstep(0.25, 1.0, p) * 0.45;

  float len = mix(0.12, 1.10, smoothstep(0.05, 1.0, p));
  float width = mix(0.075, 0.030, p);
  vec3 jet = cleanJet(q, vec2(0.0, 1.0), len, width, vec3(0.62,0.86,1.45), t*1.3);
  col += jet * mix(0.8, 1.55, p);

  // Hot cocoon wrapped around the head: broad, mildly relativistic shocked
  // stellar gas rather than a second uncollimated beam.
  float head = abs(abs(q.y) - len);
  float bow = exp(-pow(head/0.035, 2.0)) * exp(-pow(q.x/(0.12 + 0.05*p), 2.0));
  float cocoon = exp(-pow(abs(q.x)/(0.11 + 0.08*p), 2.0)) * smoothstep(0.0, len, abs(q.y)) * (1.0-smoothstep(len*0.75, len*1.08, abs(q.y)));
  col += cocoon * vec3(1.05,0.58,0.24) * (0.65 + 0.45*turb);
  col += bow * vec3(1.8, 1.05, 0.45) * 1.7;

  // Central engine: black-hole/accretion-torus scale, not a large star.
  col += exp(-r*r*260.0) * vec3(1.6, 1.05, 0.55) * 2.9;
  col += accretionDisk(q, 0.78, 0.85, 0.010, t) * 1.4;
  col = hotGlow(col, q, vec2(0.0), vec3(0.65,0.82,1.25), 0.075);
  return col;
}

// Act 3 — Prompt gamma-ray emission: internal shocks, chaotic variability
vec3 actPromptEmission(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv) * 0.85;
  vec2 q = uv;
  float r = length(q);

  // Slightly off-axis view down a narrow relativistic outflow. Prompt
  // emission appears as causally separated shells and internal shocks, not
  // as a smooth flashlight beam.
  vec2 axis = normalize(vec2(0.18, 1.0));
  float along = dot(q, axis);
  vec2 perp = q - along*axis;
  float across = length(perp);
  float beam = smoothstep(0.18, 0.025, across) * smoothstep(-0.08, 0.20, along) * (1.0-smoothstep(1.05, 1.25, along));
  float sheath = smoothstep(0.34, 0.08, across) * smoothstep(0.0, 0.30, along) * (1.0-smoothstep(0.85, 1.25, along));

  float shockTrain = 0.0;
  for(int i=0;i<6;i++){
    float fi = float(i);
    float y = fract(t*(0.42 + fi*0.045) + fi*0.173);
    float shell = exp(-pow((along - mix(0.12, 1.05, y))/0.026, 2.0));
    float ripple = 0.65 + 0.35*rfbm(vec2(across*26.0 + fi, along*12.0 - t*3.0));
    shockTrain += shell * ripple;
  }
  float pulse1 = exp(-pow(mod(t*1.7, 2.6) - 1.25, 2.0)*9.0);
  float pulse2 = exp(-pow(mod(t*2.9 + 0.5, 3.7) - 1.8, 2.0)*13.0);
  float pulseSum = pulse1 + 0.65*pulse2;

  col += sheath * vec3(0.55,0.78,1.30) * 0.45;
  col += beam * shockTrain * vec3(1.65,1.42,0.82) * (1.1 + pulseSum);
  col += beam * pow(shockTrain, 2.0) * vec3(0.72,0.94,1.65) * 1.2;

  col += exp(-r*r*180.0) * vec3(1.45, 0.95, 0.55) * 2.0;
  col += lensFlare(q, vec2(0.0), vec3(1.0,0.88,0.55), pulseSum*0.45 + 0.18);

  float flicker = (sin(t*37.0)*sin(t*61.0) + 1.0) * 0.5;
  col *= 0.88 + 0.24*flicker*pulseSum;
  return col;
}

// Act 4 — Afterglow: forward-shock expansion + multi-wavelength bands.
// Shocks are turbulent (rfbm angular bumps), not smooth orbits — these
// are expanding shells of relativistic plasma, not gravitationally bound
// orbital structures.
vec3 actAfterglow(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  vec2 q = uv;
  float r = length(q);
  float ang = atan(q.y, q.x);

  // Multi-band turbulent forward-shock fronts. The outer ring is the blast
  // wave; later bands lag behind as lower-frequency synchrotron emission
  // peaks after the high-energy light.
  for(int i=0;i<4;i++){
    float fi = float(i);
    float bandT = p - fi*0.10;
    if(bandT < 0.0) continue;
    float ringR = mix(0.10, 1.02, bandT);
    float ringTh = 0.05 + 0.05*bandT;
    float jetShape = 0.62 + 0.38*pow(abs(sin(ang)), 1.6);
    float bump = 0.55 + 0.45*rfbm(vec2(ang*5.0 + fi*2.1, t*0.13 + fi));
    float ring = exp(-pow((r-ringR*jetShape)/ringTh, 2.0)) * bump;
    vec3 bandCol =
      fi < 0.5 ? vec3(0.5, 0.85, 1.40) :    // X-ray hard
      fi < 1.5 ? vec3(1.10, 1.10, 1.10) :   // optical
      fi < 2.5 ? vec3(1.30, 0.80, 0.55) :   // NIR
                 vec3(0.55, 0.40, 0.75);    // radio
    float fade = 1.0 - 0.45*bandT;
    col += ring * bandCol * fade * 1.4;
  }

  // Filamentary shocked material and reverse-shock remnant inside the forward shock.
  float fil = rfbm(vec2(ang*5.0, r*5.0 + t*0.2));
  float filBand = exp(-pow((r-0.55*p)/0.30, 2.0)) * p;
  col += pow(fil, 1.8) * filBand * vec3(1.0, 0.80, 0.50) * 0.4;
  float reverse = exp(-pow((r-mix(0.08,0.45,p))/0.055, 2.0)) * (1.0-smoothstep(0.35,0.80,p));
  col += reverse * vec3(0.75,0.90,1.35) * 0.8;

  // Jet break: late emission remembers the original bipolar collimation.
  float jetBreak = smoothstep(0.55, 0.95, p);
  float jetSig = smoothstep(0.22, 0.02, abs(q.x)) * smoothstep(0.05, 0.85, abs(q.y));
  col += jetBreak * jetSig * vec3(0.55, 0.80, 1.20) * 0.55;

  // Fading central engine
  col += exp(-r*5.0) * vec3(0.95, 0.85, 0.65) * (0.75 - 0.6*p);
  return col;
}

vec3 dispatch(int ai, vec2 uv, float p){
  if(ai==0) return actProgenitor(uv,p);
  if(ai==1) return actCoreCollapse(uv,p);
  if(ai==2) return actJetLaunch(uv,p);
  if(ai==3) return actPromptEmission(uv,p);
  return actAfterglow(uv,p);
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
  // Cheap chromatic-aberration *feel* — single channel-shift, no extra evals.
  float ca = length(uv) * 0.40;
  col.r *= 1.0 + ca * 0.045;
  col.b *= 1.0 + ca * 0.06;
  col.g *= 1.0 - ca * 0.03;
  col = col / (1.0 + col);
  col = pow(col, vec3(0.82));
  col += hash12(gl_FragCoord.xy + uTime*60.0)*0.012 - 0.006;
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
