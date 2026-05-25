import { COSMIC_LIB } from './cosmic-engine.js';

export const SLSN_FRAGMENT = COSMIC_LIB + `

// Act 0 — Massive star with pulsational mass loss (shells)
// Act 1 — Core-collapse explosion (initial flash)
// Act 2 — Magnetar central engine kicks in (rapidly rotating, B-pumped)
// Act 3 — Superluminous peak (extremely bright transient)
// Act 4 — Nebular phase (slow decline, emission lines)

vec3 actPulsations(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 260., 0.9) * 0.4;
  float r = length(uv);
  // Star core
  float starR = 0.14;
  float limb = smoothstep(starR, starR*0.55, r);
  vec2 sph = vec2(atan(uv.y,uv.x), r);
  float surf = fbm(vec2(cos(sph.x)*3.0,sin(sph.x)*3.0)*5.0 + vec2(uTime*0.18));
  vec3 phot = blackbody(28000.);
  col = mix(col, phot*(0.5+0.55*surf), limb);
  // Three pulsational shells expanding outward
  for(int i=0;i<3;i++){
    float fi=float(i);
    float shellR = mix(0.20, 0.65, p) + fi*0.10;
    float shellTh = 0.045;
    float shell = exp(-pow((r-shellR)/shellTh, 2.0));
    col += shell * mix(vec3(1.1,0.85,0.55), vec3(0.95,0.65,0.4), fi/3.0) * 0.55;
  }
  // Soft envelope
  col += exp(-r*3.0)*0.12*phot;
  return col;
}

vec3 actCCSN(vec2 uv, float p){
  vec3 col = vec3(0.005, 0.008, 0.022);
  col += stars(uv*2.0, 250., 0.9) * 0.3;
  float r = length(uv);
  // Initial flash dominates
  float flash = exp(-r*r*22.0) * (1.0 - smoothstep(0.0, 0.5, p));
  col += flash * vec3(1.4, 1.25, 1.0) * 2.6;
  // Expanding shock
  float shockR = mix(0.05, 0.45, p);
  float shockTh = 0.05 + 0.05*p;
  float shock = exp(-pow((r-shockR)/shockTh,2.0));
  col += shock * vec3(1.0, 0.85, 0.55) * 1.5;
  // Pre-existing shells visible in scatter (CSM interaction)
  for(int i=0;i<2;i++){
    float fi=float(i);
    float shellR = 0.55 + fi*0.10;
    float shellTh = 0.05;
    float shell = exp(-pow((r-shellR)/shellTh,2.0));
    col += shell * vec3(0.55, 0.45, 0.35) * 0.4;
  }
  return col;
}

vec3 actMagnetar(vec2 uv, float p){
  vec3 col = vec3(0.006, 0.010, 0.025);
  col += stars(uv*2.0, 250., 0.85) * 0.3;
  float r = length(uv);
  // Bright spinning core — magnetar
  float spinR = 0.05;
  float core = exp(-r*r*100.0);
  col += core * vec3(0.65, 0.85, 1.4) * (1.8 + 0.6*sin(uTime*8.0));
  // Pulsar beams
  float ang = atan(uv.y, uv.x);
  float beam = pow(0.5+0.5*cos(ang*1.0 - uTime*3.0), 32.0);
  float beamR = exp(-pow((r-0.0)/0.6,2.0));
  col += beam * beamR * vec3(0.55,0.85,1.4) * 1.2;
  // Inflating bubble (magnetar wind nebula) within ejecta
  float bubbleR = mix(0.1, 0.6, p);
  float bubble = smoothstep(bubbleR, bubbleR*0.95, r) * smoothstep(0.06, bubbleR*0.5, r);
  col += bubble * vec3(0.45, 0.70, 1.20) * 0.7;
  // Outer ejecta shell
  float shock = exp(-pow((r-0.85+0.05*p)/0.10, 2.0));
  col += shock * vec3(1.0, 0.75, 0.45) * 0.5;
  return col;
}

vec3 actPeak(vec2 uv, float p){
  vec3 col = vec3(0.006, 0.010, 0.025);
  col += stars(uv*2.0, 240., 0.85) * 0.3;
  float r = length(uv);
  // Massive bright central region (uniform photosphere)
  float photR = mix(0.30, 0.50, p);
  float phot = smoothstep(photR, photR*0.9, r);
  // Color — initially UV/blue then settles
  vec3 photCol = mix(vec3(0.7,1.0,1.4), vec3(0.9,0.95,1.05), p);
  col += phot * photCol * 1.4;
  // Radial spikes
  float ang = atan(uv.y, uv.x);
  float spike = pow(0.5+0.5*sin(ang*12.0 + uTime*0.7), 6.0);
  float spikeR = exp(-pow((r-photR-0.1)/0.10,2.0));
  col += spike*spikeR*vec3(0.8,1.0,1.3)*0.55;
  // Soft halo
  col += exp(-pow((r-photR-0.1)/0.30,2.0)) * vec3(0.4,0.65,1.0) * 0.6;
  return col;
}

vec3 actNebular(vec2 uv, float p){
  vec3 col = vec3(0.008, 0.011, 0.023);
  col += stars(uv*2.0, 240., 0.85) * 0.35;
  float r = length(uv);
  // Diffuse, large, fainter
  float diff = exp(-pow((r-0.35-0.10*p)/0.45, 2.0));
  // Emission-line-like filaments
  float fil = fbm(vec2(r*8.0, atan(uv.y,uv.x)*4.0 + uTime*0.15));
  col += diff * (0.5+0.7*fil) * mix(vec3(1.0,0.7,0.4), vec3(0.95,0.5,0.3), p) * 0.95;
  // Central glow
  col += exp(-r*r*30.0) * vec3(0.95,0.85,0.6) * 0.6;
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

export const SLSN_ACTS = [
  { selector: '#act-pulsations', name: 'pulsations' },
  { selector: '#act-ccsn',       name: 'ccsn' },
  { selector: '#act-magnetar',   name: 'magnetar' },
  { selector: '#act-peak',       name: 'peak' },
  { selector: '#act-nebular',    name: 'nebular' },
];
