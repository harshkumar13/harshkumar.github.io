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

  // Inflated cocoon (volumetric)
  vec4 cocoon = volNebula(q, vec2(0.0), 0.40, vec3(1.4, 0.8, 0.4), vec3(0.50, 0.20, 0.10), 1.0, t);
  col = col*cocoon.w + cocoon.rgb;

  // Jets — narrowing as they accelerate; Lorentz factor rises with p
  float lor = mix(5.0, 100.0, p);
  float len = mix(0.20, 1.05, p);
  vec3 jetN = relJet(q, vec2(0.0,  1.0), len, mix(0.10, 0.04, p), lor, vec3(0.85,1.05,1.40), t);
  vec3 jetS = relJet(q, vec2(0.0, -1.0), len, mix(0.10, 0.04, p), lor, vec3(0.85,1.05,1.40), t);
  col += jetN + jetS;

  // Central engine glow
  col += exp(-r*r*150.0) * vec3(1.4, 1.0, 0.7) * 2.4;
  col = hotGlow(col, q, vec2(0.0), vec3(0.6,0.8,1.2), 0.10);
  col += lensFlare(q, vec2(0.0), vec3(0.7,0.9,1.3), 0.6);

  // Bow shock at jet head
  float headY = len;
  float bow = exp(-pow((abs(q.y) - headY)/0.04, 2.0)) * smoothstep(0.18, 0.0, abs(q.x));
  col += bow * vec3(1.4, 0.95, 0.55) * 1.2;
  return col;
}

// Act 3 — Prompt gamma-ray emission: internal shocks, chaotic variability
vec3 actPromptEmission(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv) * 0.85;
  vec2 q = uv;
  float r = length(q);

  // Two wide jets visible (we are slightly off-axis)
  float jetX = abs(q.x);
  float jetWidth = mix(0.16, 0.10, p);
  float withinJet = smoothstep(jetWidth, jetWidth*0.35, jetX) * smoothstep(1.1, 0.4, abs(q.y));

  // Internal shocks — ridged turbulence
  float chaos = rfbm(vec2(q.x*8.0, q.y*5.0 - t*4.0));
  chaos += 0.55*rfbm(vec2(q.x*18.0, q.y*14.0 - t*7.0));
  chaos = pow(chaos, 1.6);

  // Random gamma-ray pulses
  float pulse1 = exp(-pow(mod(t*1.5, 3.0) - 1.5, 2.0)*8.0);
  float pulse2 = exp(-pow(mod(t*2.3 + 0.7, 4.0) - 2.0, 2.0)*12.0);
  float pulseSum = pulse1 + 0.7*pulse2;

  vec3 jetCol = mix(vec3(1.0, 0.8, 0.4), vec3(1.4, 1.2, 0.9), chaos);
  col += withinJet * chaos * jetCol * 1.6;
  col += withinJet * pulseSum * vec3(1.6, 1.4, 1.0) * 1.4;

  // Central engine
  col += exp(-r*r*120.0) * vec3(1.5, 1.0, 0.7) * 2.4;
  col += lensFlare(q, vec2(0.0), vec3(1.0,0.85,0.55), pulseSum*0.55 + 0.25);

  // Subtle gamma flicker overlay
  float flicker = (sin(t*30.0)*sin(t*47.0) + 1.0) * 0.5;
  col *= 0.9 + 0.2*flicker*pulseSum;
  return col;
}

// Act 4 — Afterglow: forward-shock expansion + multi-wavelength bands
vec3 actAfterglow(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  vec2 q = uv;
  float r = length(q);

  // Multi-band rings — X-ray (blue, inside) → optical → IR (outside)
  for(int i=0;i<4;i++){
    float fi = float(i);
    float bandT = p - fi*0.10;
    if(bandT < 0.0) continue;
    float ringR = mix(0.15, 0.95, bandT);
    float ringTh = 0.04 + 0.04*bandT;
    float ring = exp(-pow((r-ringR)/ringTh, 2.0));
    vec3 bandCol =
      fi < 0.5 ? vec3(0.5, 0.85, 1.40) :    // X-ray hard
      fi < 1.5 ? vec3(1.10, 1.10, 1.10) :   // optical
      fi < 2.5 ? vec3(1.30, 0.80, 0.55) :   // NIR
                 vec3(0.55, 0.40, 0.75);    // radio
    float fade = 1.0 - 0.45*bandT;
    col += ring * bandCol * fade * 1.4;
  }

  // Faint forward shock surface (a brighter halo at outer band edge)
  float fs = exp(-pow((r-mix(0.18,1.1,p))/0.05, 2.0));
  col += fs * vec3(1.0, 0.95, 0.85) * 1.0;

  // Jet break — late narrowing fan along axis
  float jetBreak = smoothstep(0.55, 0.95, p);
  float jetSig = (1.0 - smoothstep(0.0, 0.25, abs(q.x))) * exp(-pow(q.y*0.7, 2.0));
  col += jetBreak * jetSig * vec3(0.55, 0.80, 1.20) * 0.7;

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
  // Cheap chromatic aberration
  float ca = length(uv) * 0.0024;
  vec2 dir = normalize(uv + 1e-5);
  vec3 caCol = vec3(dispatch(ai, uv - dir*ca, p).r, col.g, dispatch(ai, uv + dir*ca, p).b);
  col = mix(col, caCol, 0.16);
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
