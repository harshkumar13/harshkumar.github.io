import { COSMIC_LIB } from './cosmic-engine.js';

export const KN_FRAGMENT = COSMIC_LIB + `

// Helper — binary NS as two glowing dots with grav-glow + GW grid warp
vec3 nsBinary(vec2 uv, float p, float sepStart, float sepEnd, float omegaStart, float omegaEnd, float t){
  vec3 col = deepSky(uv);
  float sep   = mix(sepStart, sepEnd, p);
  float omega = mix(omegaStart, omegaEnd, p);
  vec2 a = vec2(cos(t*omega), sin(t*omega)) * sep;
  vec2 b = -a;

  // Spacetime grid warped by both compact masses
  col += spacetimeGrid2(uv, a, 0.05, b, 0.05, vec3(0.30, 0.50, 0.85), 6.5) * 0.55;

  // GW + and × strain pattern in background
  float freq  = mix(8.0, 26.0, p);
  float phase = t*omega*1.6;
  float strain = gwPlus(uv, freq, phase)*0.5 + gwCross(uv, freq, phase + PI*0.5)*0.5;
  col += smoothstep(0.55, 1.0, abs(strain)) * vec3(0.40, 0.70, 1.10) * 0.55;

  // NSs
  col = hotGlow(col, uv, a, vec3(0.90,0.95,1.15)*1.3, 0.05);
  col = hotGlow(col, uv, b, vec3(1.10,0.85,0.95)*1.3, 0.05);
  col += exp(-length(uv-a)*50.0) * vec3(1.0, 1.0, 1.05) * 1.6;
  col += exp(-length(uv-b)*50.0) * vec3(1.0, 0.95, 1.0) * 1.6;
  return col;
}

vec3 actInspiral(vec2 uv, float p){
  return nsBinary(uv, p, 0.36, 0.20, 1.8, 5.0, uTime);
}
vec3 actFinalOrbit(vec2 uv, float p){
  return nsBinary(uv, p, 0.20, 0.06, 5.0, 22.0, uTime);
}

vec3 actMerger(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  float r = length(uv);

  // Pre-merger violent grid warp
  col += spacetimeGrid2(uv, vec2(0.01,0.0), 0.10, vec2(-0.01,0.0), 0.10,
                       vec3(0.35, 0.55, 1.10), 6.0) * 0.65;

  // Bright merger flash (decays through act)
  float flash = exp(-r*r*40.0) * (1.0 - smoothstep(0.0, 0.5, p));
  col += flash * vec3(1.5, 1.4, 1.2) * 3.4;
  col += lensFlare(uv, vec2(0.0), vec3(1.0,1.0,0.9), (1.0-p)*0.95);

  // Ringdown waves outward (chirp)
  for(int i=0;i<3;i++){
    float fi = float(i);
    float ringR = mix(0.0, 0.85, p) + fi*0.18;
    float ring = exp(-pow((r-ringR)/0.04, 2.0));
    col += ring * vec3(0.55, 0.85, 1.10) * (0.85 - fi*0.20);
  }

  // Polar wind ejecta beginning to emerge — volumetric
  vec4 wind = volNebula(uv, vec2(0.0), 0.50*p, vec3(1.5, 1.1, 0.85), vec3(0.30, 0.55, 1.10), 0.7, t);
  col = col*wind.w + wind.rgb * smoothstep(0.2, 1.0, p);

  // Tidal ejecta fan (equatorial)
  float yProf = exp(-pow(uv.y*7.0, 2.0));
  float fan = smoothstep(0.20, 0.45, abs(uv.x)) * (1.0 - smoothstep(0.5, 0.95, abs(uv.x)));
  col += fan*yProf*vec3(1.20, 0.50, 0.30) * smoothstep(0.3, 0.95, p) * 1.0;

  return col;
}

vec3 actBlueKilonova(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  // Polar wind ejecta — volumetric, blue (lanthanide-poor, low opacity)
  vec2 polUv = uv;
  polUv.x *= 1.6; // bias polar (vertical)
  vec4 neb = volNebula(polUv, vec2(0.0), 0.45 + 0.2*p, vec3(0.90, 1.10, 1.40), vec3(0.20, 0.40, 0.85), 1.3, t);
  col = col*neb.w + neb.rgb;

  // Central hypermassive NS / BH remnant
  col += exp(-length(uv)*length(uv)*100.0) * vec3(1.2, 1.1, 1.05) * 2.0;
  col = hotGlow(col, uv, vec2(0.0), vec3(0.7,0.9,1.2), 0.12);
  col += lensFlare(uv, vec2(0.0), vec3(0.6,0.8,1.2), 0.35);

  // Faint NS-NS GW grid memory
  col += spacetimeGrid(uv, vec2(0.0), 0.04, vec3(0.25, 0.40, 0.75), 7.0) * 0.18;
  return col;
}

vec3 actRedKilonova(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  // Equatorial dynamical ejecta — red (lanthanide-rich, high opacity)
  vec2 eqUv = uv;
  eqUv.y *= 1.8; // bias equatorial (horizontal)
  vec4 neb = volNebula(eqUv, vec2(0.0), 0.55 + 0.20*p, vec3(1.40, 0.55, 0.30), vec3(0.40, 0.10, 0.05), 1.5, t);
  col = col*neb.w + neb.rgb;

  // Persisting blue polar component (now dimmer)
  vec2 polUv = uv;
  polUv.x *= 1.6;
  vec4 wind = volNebula(polUv, vec2(0.0), 0.40, vec3(0.45, 0.70, 1.10), vec3(0.10, 0.15, 0.30), 0.6, t);
  col += wind.rgb * (1.0-p) * 0.7;

  // r-process spectral filaments — striated emission bands
  float a = atan(uv.y, uv.x);
  float bandPhase = length(uv)*22.0 - t*0.5;
  float bands = pow(0.5+0.5*sin(bandPhase + sin(a*4.0)*1.5), 6.0);
  col += bands * emHalpha() * smoothstep(0.10, 0.65, length(uv)) * smoothstep(0.85, 0.50, length(uv)) * 0.35;

  // Late-time central glow
  col += exp(-length(uv)*length(uv)*30.0) * vec3(0.95, 0.70, 0.55) * 0.85;
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

export const KN_ACTS = [
  { selector: '#act-inspiral',    name: 'inspiral' },
  { selector: '#act-finalorbit',  name: 'final-orbit' },
  { selector: '#act-merger',      name: 'merger' },
  { selector: '#act-bluekn',      name: 'blue-kilonova' },
  { selector: '#act-redkn',       name: 'red-kilonova' },
];
