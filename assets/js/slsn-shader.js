import { COSMIC_LIB } from './cosmic-engine.js';

export const SLSN_FRAGMENT = COSMIC_LIB + `

// Act 0 — Pulsational mass loss: massive blue star ejects shells
vec3 actPulsations(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  float r = length(uv);

  // Massive blue star core
  float starR = 0.14;
  float limb  = smoothstep(starR, starR*0.55, r);
  float lon = atan(uv.y, uv.x);
  float surf = fbm(vec2(cos(lon)*3.0, sin(lon)*3.0)*5.0 + vec2(t*0.18));
  vec3 phot = blackbody(32000.);
  col = mix(col, phot * (0.50+0.55*surf), limb);

  // Three nested shells expanding outward — different ages, different densities
  for(int i=0;i<3;i++){
    float fi = float(i);
    float age = fi*0.30 + p*0.40;
    float shellR = 0.20 + age*0.55;
    float shellTh = 0.040 + age*0.020;
    float shell = exp(-pow((r-shellR)/shellTh, 2.0));
    // Bumpy shell — fbm in angular coords
    float bump = 0.55 + 0.55*fbm(vec2(lon*5.0 + fi*3.0, t*0.2));
    shell *= bump;
    vec3 shellCol = mix(vec3(1.1, 0.85, 0.55), vec3(0.95, 0.55, 0.30), age*0.8);
    col += shell * shellCol * mix(1.2, 0.5, fi/3.0);
  }

  // Soft envelope glow
  col += exp(-r*3.0)*0.18 * phot;
  col = hotGlow(col, uv, vec2(0.0), vec3(0.7,0.85,1.15), 0.10);
  col += lensFlare(uv, vec2(0.0), vec3(0.65,0.80,1.15), 0.30);
  return col;
}

// Act 1 — Core collapse SN explosion
vec3 actCCSN(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  float r = length(uv);

  // Initial flash dominates
  float flash = exp(-r*r*22.0) * (1.0 - smoothstep(0.0, 0.5, p));
  col += flash * vec3(1.45, 1.30, 1.10) * 3.0;
  col += lensFlare(uv, vec2(0.0), vec3(1.0,0.95,0.75), (1.0-p)*0.85);

  // Expanding turbulent shock front
  float shockR = mix(0.05, 0.50, p);
  float shockTh = 0.05 + 0.06*p;
  float ang = atan(uv.y, uv.x);
  float bumpy = 0.6 + 0.5*rfbm(vec2(ang*6.0, r*5.0 + t*0.3));
  float shock = exp(-pow((r-shockR)/shockTh, 2.0)) * bumpy;
  col += shock * vec3(1.10, 0.85, 0.55) * 1.6;

  // Pre-existing CSM shells (interaction visible)
  for(int i=0;i<2;i++){
    float fi = float(i);
    float shellR = 0.60 + fi*0.13;
    float shellTh = 0.05;
    float shellInt = exp(-pow((r-shellR)/shellTh, 2.0));
    // Interaction lights up where shock has hit CSM (after t > shellR / shockSpeed)
    float lit = smoothstep(shellR-0.05, shellR+0.05, shockR);
    col += shellInt * lit * vec3(1.0, 0.75, 0.45) * 1.0;
  }
  return col;
}

// Act 2 — Magnetar central engine pumps the ejecta
vec3 actMagnetar(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  float r = length(uv);

  // Spinning beam (pulsar lighthouse)
  float ang = atan(uv.y, uv.x);
  float spin = uTime * 8.0;
  float beam = pow(0.5+0.5*cos(ang - spin), 32.0) + pow(0.5+0.5*cos(ang - spin + PI), 32.0);
  float beamFalloff = exp(-r*1.5);
  col += beam * beamFalloff * vec3(0.55, 0.85, 1.40) * 1.2;

  // Inflating pulsar wind nebula (volumetric, bright blue-violet)
  vec4 pwn = volNebula(uv, vec2(0.0), 0.40 + 0.30*p, vec3(0.55, 0.95, 1.50), vec3(0.20, 0.20, 0.55), 1.3, t);
  col = col*pwn.w + pwn.rgb;

  // Central magnetar core — extremely bright, blue
  col += exp(-r*r*350.0) * vec3(0.70, 1.05, 1.60) * (2.5 + 0.6*sin(t*12.0));
  col = hotGlow(col, uv, vec2(0.0), vec3(0.6,0.85,1.4), 0.10);
  col += lensFlare(uv, vec2(0.0), vec3(0.5,0.75,1.35), 0.60);

  // Outer ejecta shell (containment boundary)
  float shellR = mix(0.50, 0.90, p);
  float shell = exp(-pow((r-shellR)/0.08, 2.0));
  col += shell * vec3(1.0, 0.75, 0.45) * 0.7;

  // Magnetic-field lines (faint streaks)
  for(int i=0;i<4;i++){
    float fi = float(i);
    float ph = ang*1.5 + fi*1.6 + spin*0.5 + r*5.0;
    float streak = pow(0.5+0.5*sin(ph), 8.0);
    streak *= exp(-pow((r-0.30-fi*0.04)/0.06, 2.0)) * 0.5;
    col += streak * vec3(0.55, 0.85, 1.30) * 0.5;
  }
  return col;
}

// Act 3 — Superluminous peak: bright photosphere
vec3 actPeak(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  float r = length(uv);

  // Volumetric, very luminous photosphere
  vec4 phot = volNebula(uv, vec2(0.0), 0.50, vec3(1.10, 1.30, 1.60), vec3(0.50, 0.65, 1.00), 1.6, t);
  col = col*phot.w + phot.rgb * 1.4;

  // Bright photospheric edge
  float photR = mix(0.30, 0.45, p);
  float photEdge = exp(-pow((r-photR)/0.05, 2.0));
  col += photEdge * vec3(0.85, 1.05, 1.30) * 1.4;

  // Radial spikes (extreme energy outflow)
  float ang = atan(uv.y, uv.x);
  float spike = pow(0.5+0.5*sin(ang*8.0 + t*0.7), 6.0);
  float spikeR = exp(-pow((r-photR-0.10)/0.10, 2.0));
  col += spike * spikeR * vec3(0.85, 1.05, 1.30) * 0.75;

  col = hotGlow(col, uv, vec2(0.0), vec3(0.7,0.9,1.3), 0.18);
  col += lensFlare(uv, vec2(0.0), vec3(0.65,0.85,1.20), 0.7);
  return col;
}

// Act 4 — Nebular phase: diffuse late-time emission, forbidden lines
vec3 actNebular(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv) * 1.0;
  float r = length(uv);

  // Diffuse expanding ejecta — fades into emission-line filaments
  vec4 neb = volNebula(uv, vec2(0.0), 0.60 + 0.20*p, vec3(1.0, 0.65, 0.45), vec3(0.30, 0.20, 0.35), 0.8, t);
  col = col*neb.w + neb.rgb * 0.85;

  // Filaments — forbidden-line emission (Hα + [O III] mixture)
  float ang = atan(uv.y, uv.x);
  float fil = rfbm(vec2(ang*4.0, r*4.0 + t*0.18));
  fil = pow(fil, 1.4);
  float bandR = exp(-pow((r-0.45-0.15*p)/0.25, 2.0));
  col += fil * bandR * (0.55*emHalpha() + 0.45*emOIII()) * 1.1;

  // Central glow (fading magnetar)
  col += exp(-r*r*40.0) * vec3(0.85, 0.70, 0.55) * (0.75 - 0.5*p);
  col = hotGlow(col, uv, vec2(0.0), vec3(0.8,0.65,0.55), 0.14);
  return col;
}

vec3 dispatch(int ai, vec2 uv, float p){
  if(ai==0) return actPulsations(uv,p);
  if(ai==1) return actCCSN(uv,p);
  if(ai==2) return actMagnetar(uv,p);
  if(ai==3) return actPeak(uv,p);
  return actNebular(uv,p);
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
  col = mix(col, caCol, 0.16);
  col = col / (1.0 + col);
  col = pow(col, vec3(0.82));
  col += hash12(gl_FragCoord.xy + uTime*60.0)*0.012 - 0.006;
  outColor = vec4(col, 1.0);
}
`;

export const SLSN_ACTS = [
  { selector: '#act-pulsations', name: 'pulsations' },
  { selector: '#act-ccsn',       name: 'ccsn' },
  { selector: '#act-magnetar',   name: 'magnetar' },
  { selector: '#act-peak',       name: 'peak' },
  { selector: '#act-nebular',    name: 'nebular' },
];
