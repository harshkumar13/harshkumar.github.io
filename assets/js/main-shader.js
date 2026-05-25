import { COSMIC_LIB } from './cosmic-engine.js';

export const MAIN_FRAGMENT = COSMIC_LIB + `

// =============================================================
// ACT 0 — HERO · Birth: volumetric molecular cloud → protostar ignition
// =============================================================
vec3 actBirth(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  // Camera slowly drifts as we descend into the cloud
  vec2 q = uv + vec2(sin(t*0.05)*0.02, cos(t*0.04)*0.01);

  // Volumetric protostellar cloud — cold blue → warm orange as collapse proceeds
  vec3 cold = mix(emHbeta()*0.55 + vec3(0.08,0.10,0.22), emHalpha()*0.45 + vec3(0.10,0.05,0.04), p);
  vec3 hot  = mix(vec3(0.50,0.60,0.95),                    vec3(1.40,0.95,0.55), p);
  float radius  = mix(0.95, 0.32, smoothstep(0.0,0.85,p));
  float density = mix(0.6, 1.8, p);
  vec4 neb = volNebula(q, vec2(0.0), radius, hot, cold, density, t);
  col = col * neb.w + neb.rgb;

  // Bipolar Herbig-Haro outflow appears mid-collapse, accretion disk forms late
  float ign = smoothstep(0.35, 0.85, p);
  if(ign > 0.001){
    // Two cone-jets along y axis (north + south)
    vec3 jetN = relJet(q, vec2(0.0, 1.0), 0.95, 0.05, 4.0 + ign*8.0, vec3(0.5,0.8,1.3), t);
    vec3 jetS = relJet(q, vec2(0.0,-1.0), 0.95, 0.05, 4.0 + ign*8.0, vec3(0.5,0.8,1.3), t);
    col += (jetN + jetS) * ign;
    // Tilted protoplanetary disk (very edge-on so it reads as a line)
    col += accretionDisk(q, 0.78, 0.0, 0.045, t) * ign * 0.75;
  }

  // Protostar core ignites near the end
  float core = exp(-length(q)*length(q)*1100.0*max(1.0-ign,0.05));
  vec3 starCol = blackbody(mix(2400., 7500., ign));
  col = hotGlow(col, q, vec2(0.0), starCol*ign*1.3, 0.10);
  col += core * starCol * (1.5 + 8.0*ign);

  // Lens flare on ignition
  col += lensFlare(q, vec2(0.0), starCol, ign*0.7);
  return col;
}

// =============================================================
// ACT 1 — ABOUT · Main Sequence: G-type star with granulation, prominences, orbits
// =============================================================
vec3 actMainSequence(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  vec2 q = uv;
  float r = length(q);

  float starR = 0.19;
  float limb  = smoothstep(starR, starR*0.55, r);

  // Granulation cells (Voronoi-flavored fbm in spherical coordinates)
  float lat = q.y / starR;
  float lon = atan(q.y, q.x);
  vec2  sph = vec2(cos(lon)*starR, sin(lon)*starR) + vec2(t*0.08, -t*0.06);
  float gran = fbm(vec2(cos(lon)*4.0, sin(lon)*4.0)*4.0 + vec2(t*0.12, 0.0));
  gran += 0.5*fbm(vec2(cos(lon)*8.0, sin(lon)*8.0)*7.0 - vec2(t*0.2));
  gran = smoothstep(0.30, 0.95, gran);

  // Limb darkening (Eddington μ-law approximation)
  float mu = sqrt(max(0.0, 1.0 - pow(r/starR, 2.0)));
  float limbDark = 0.5 + 0.5*mu;

  // Sunspots
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 sp = vec2(cos(t*0.05 + fi*2.1)*starR*0.45, sin(t*0.04 + fi*1.7)*starR*0.35);
    float sd = length(q - sp);
    gran -= smoothstep(0.04, 0.0, sd) * 0.85;
  }
  gran = max(gran, 0.0);

  vec3 phot = blackbody(5800.);
  col = mix(col, phot * (0.45 + 0.55*gran) * limbDark, limb);

  // Coronal loops near limb (arched filaments around magnetic regions)
  float arch = pow(0.5+0.5*sin(lon*7.0 + t*0.6), 6.0);
  float archR = exp(-pow((r - starR - 0.04)/0.05, 2.0));
  col += arch * archR * vec3(0.85, 0.60, 0.45) * 0.7 * (1.0-limb);

  // Prominence — single bright loop at limb
  float promAng = -0.7 + 0.5*sin(t*0.2);
  vec2  promCenter = vec2(cos(promAng), sin(promAng)) * (starR + 0.04);
  float pd = length(q - promCenter);
  col += smoothstep(0.10, 0.0, pd) * emHalpha() * 1.3 * (1.0-limb);

  // Corona — soft outer glow with subtle striations
  float corona = exp(-pow((r-starR)/0.50, 2.0)*5.0) * (1.0-limb);
  float striae = 0.45 + 0.55*pow(0.5+0.5*sin(lon*5.0 + fbm(vec2(lon*3.0, t*0.4))*5.0), 4.0);
  col += corona * striae * mix(vec3(1.0,0.85,0.55), vec3(1.0,1.0,0.95), 0.5) * 1.1;

  // Lens flare anchored on the sun
  col += lensFlare(q, vec2(0.0), vec3(1.0,0.95,0.70), 0.35);

  // Three orbital tracks with planets
  for(int i=0;i<3;i++){
    float fi = float(i);
    float orbR = 0.34 + fi*0.13;
    float incl = 0.20 + fi*0.07;
    vec2 op = rot(0.5 + fi*0.25) * q;
    op.y /= max(incl, 0.05);
    float d = abs(length(op) - orbR);
    float ring = smoothstep(0.010, 0.0, d) * (0.40 - fi*0.07);
    col += ring * vec3(0.55, 0.75, 1.0);
    // Planet bead
    float ph = t*(0.5 - fi*0.12) + fi*2.1;
    vec2 plPos = rot(-0.5 - fi*0.25) * vec2(cos(ph)*orbR, sin(ph)*orbR*incl);
    float plD = length(q - plPos);
    col += smoothstep(0.014, 0.0, plD) * vec3(1.0, 0.90, 0.70) * (0.85 - fi*0.10);
    // Small inner shadow ring
    col -= smoothstep(0.012, 0.006, plD) * 0.6 * vec3(0.1,0.05,0.0);
  }

  // Inner core glow
  col += exp(-r*3.6)*0.16 * phot;
  return col;
}

// =============================================================
// ACT 2 — RESEARCH · A single focal supernova remnant with a
// pulsar at its heart; palette and structure morph subtly through
// the transient-class colors as scroll progresses (GRB → kilonova →
// SLSN → TDE), but it's always ONE coherent scene.
// =============================================================
vec3 actResearch(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  // Subtle camera drift
  vec2 q = rot(0.05*sin(t*0.18)) * uv;
  float r = length(q);
  float ang = atan(q.y, q.x);

  // Palette morph through 4 transient regimes
  // 0..0.25 = GRB warm-blue
  // 0.25..0.50 = Kilonova red/blue
  // 0.50..0.75 = SLSN violet/blue
  // 0.75..1.0  = TDE warm orange
  vec3 hot  = mix(vec3(1.0,0.85,0.55), vec3(1.30,0.55,0.40), smoothstep(0.10,0.35,p));
  hot       = mix(hot,                   vec3(0.65,0.85,1.30), smoothstep(0.40,0.65,p));
  hot       = mix(hot,                   vec3(1.10,0.70,0.30), smoothstep(0.70,0.95,p));
  vec3 cold = vec3(0.20,0.10,0.05);

  // Volumetric SNR / remnant nebula — the centerpiece
  vec4 neb = volNebula(q, vec2(0.0), 0.85, hot, cold, 1.5, t);
  col = col*neb.w + neb.rgb;

  // Filamentary shock front — ridged turbulence in radial coords
  float fil = rfbm(vec2(ang*4.0, r*4.5 + t*0.18));
  fil = pow(fil, 1.5);
  float bandR = exp(-pow((r-0.55)/0.20, 2.0));
  col += fil * bandR * hot * 0.45;

  // Central pulsar/magnetar with lighthouse beam
  float core = exp(-r*r*900.0);
  col += core * vec3(1.20, 1.10, 0.95) * 2.6;
  col = hotGlow(col, q, vec2(0.0), vec3(1.0, 0.9, 0.7), 0.08);

  // Lighthouse beam (two opposite cones rotating)
  float spin = uTime * 1.0;
  float beamPattern = pow(0.5+0.5*cos(ang - spin), 36.0) + pow(0.5+0.5*cos(ang - spin + PI), 36.0);
  float beamRadial = exp(-r*1.6);
  col += beamPattern * beamRadial * vec3(0.85, 0.95, 1.20) * 0.85;

  // Anamorphic lens flare
  col += lensFlare(q, vec2(0.0), vec3(1.0, 0.92, 0.75), 0.55);

  return col;
}

// =============================================================
// ACT 3 — CV · Worldline / Minkowski light cone
// =============================================================
vec3 actLightCone(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);

  // Minkowski axes: x = space, y = time (upward = future)
  vec2 q = uv;
  float slope = 0.85;            // photon slope (c=1)
  float dist = abs(q.x) - q.y*slope;
  float inside = smoothstep(0.01, -0.01, dist);

  // Cone edges (null geodesics) — pulse with photons
  float edge = exp(-abs(dist)*60.0);
  col += edge * vec3(0.50, 0.80, 1.10) * 0.70;

  // 12 year ticks (2012..2024) ignite progressively
  for(int i=0;i<12;i++){
    float fi = float(i);
    float ringT = 0.08 + fi*0.080;
    float ringR = ringT;
    float maxX  = ringT * slope;
    // Ring drawn as horizontal segment at y=ringT, |x|<maxX
    float onRing = smoothstep(0.006, 0.0, abs(q.y - ringT));
    float withinCone = smoothstep(maxX+0.005, maxX-0.005, abs(q.x));
    float litAt = (fi+1.0)/13.0;
    float lit = smoothstep(litAt - 0.05, litAt, p);
    float ring = onRing * withinCone * lit;
    vec3 ringCol = mix(vec3(0.40,0.60,1.00), vec3(1.00,0.85,0.50), lit);
    col += ring * ringCol * 1.4;
    // Tick endpoints (events)
    float tickL = smoothstep(0.014, 0.0, length(q - vec2(-maxX, ringT)));
    float tickR = smoothstep(0.014, 0.0, length(q - vec2( maxX, ringT)));
    col += (tickL+tickR) * vec3(1.00,0.90,0.60) * lit * 2.0;
  }

  // Photon paths racing up the cone edges
  float ph = mod(t*0.25, 1.0);
  float photonY = ph;
  float photonX = photonY * slope;
  col += exp(-pow((q.x - photonX)*40.0,2.0) - pow((q.y - photonY)*40.0,2.0))
       * vec3(1.0, 0.9, 0.7) * 1.3;
  col += exp(-pow((q.x + photonX)*40.0,2.0) - pow((q.y - photonY)*40.0,2.0))
       * vec3(1.0, 0.9, 0.7) * 1.3;

  // The CV "observer" — worldline of the user (origin)
  col += exp(-length(q)*60.0) * vec3(1.0, 0.95, 0.75) * 1.6;

  // Light cone interior — a faint wash
  col += inside * vec3(0.04, 0.07, 0.18) * 0.55;
  return col;
}

// =============================================================
// ACT 4 — PUBLICATIONS · Spiral galaxy of citations
// =============================================================
vec3 actCitations(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv);
  // Galaxy at center, scaled by progress for a "zoom-out" feel
  float scale = mix(0.18, 0.55, smoothstep(0.0, 0.6, p));
  col += spiralGalaxy(uv, vec2(0.0, 0.0), scale, t + p*2.0);
  // Anchor bright "papers" — extra glowing knots in the arms
  for(int i=0;i<14;i++){
    float fi=float(i);
    float ang = fi*1.7 + t*0.18;
    float rad = 0.18 + (fi/14.0)*0.40 + 0.04*sin(t*0.3 + fi);
    vec2 p2 = vec2(cos(ang)*rad, sin(ang)*rad*0.5);
    float d = length(uv - p2);
    float k = exp(-d*40.0) * 0.9;
    vec3 ktint = mix(vec3(0.7,0.9,1.2), vec3(1.0,0.85,0.55), hash11(fi));
    col += k * ktint;
    // Soft glow
    col += exp(-d*8.0)*0.04*ktint;
  }
  // Faint vignette
  col *= 1.0 - 0.30 * pow(length(uv), 2.0);
  return col;
}

// =============================================================
// ACT 5 — CONTACT · GW chirp + Schwarzschild grid warp
// =============================================================
vec3 actGravitationalWave(vec2 uv, float p){
  float t = uTime;
  vec3 col = deepSky(uv) * 0.85;

  // Two compact objects spiraling — sep and omega chirp
  float chirp = pow(1.0 - clamp(p*0.95 + 0.05, 0.0, 1.0), 1.3);
  float omega = mix(2.5, 28.0, 1.0 - chirp);
  float sep   = mix(0.04, 0.32, chirp);
  vec2 a = vec2(cos(t*omega), sin(t*omega)) * sep;
  vec2 b = -a;
  float coal = smoothstep(0.06, 0.0, sep);

  // Spacetime grid warped by both masses
  col += spacetimeGrid2(uv, a, 0.06, b, 0.06, vec3(0.25, 0.42, 0.75), 7.0) * 0.55;

  // + and × polarization rings — strain pattern radiating outward
  float freq  = mix(6.0, 30.0, 1.0 - chirp);
  float phase = t * omega * 1.5;
  float hp = gwPlus(uv, freq, phase);
  float hx = gwCross(uv, freq, phase + PI*0.5);
  float strain = hp * 0.55 + hx * 0.45;
  vec3 strainCol = mix(vec3(0.55, 0.85, 1.10), vec3(0.95, 0.65, 1.10), 0.5+0.5*sin(t*0.3));
  col += smoothstep(0.55, 1.0, abs(strain)) * strainCol * 0.85;

  // The compact objects themselves — bright spheres with gravitational glow
  col += hotGlow(vec3(0.0), uv, a, vec3(0.90, 0.95, 1.15)*1.3, 0.04);
  col += hotGlow(vec3(0.0), uv, b, vec3(1.10, 0.85, 0.95)*1.3, 0.04);
  col += exp(-length(uv-a)*50.0) * vec3(1.0,1.0,1.05) * 1.6;
  col += exp(-length(uv-b)*50.0) * vec3(1.0,0.95,1.0) * 1.6;

  // Merger flash + ringdown
  float merge = pow(coal, 4.0);
  col += merge * exp(-length(uv)*3.5) * vec3(1.0, 1.0, 0.95) * 2.4;

  // Late-time outgoing ringdown ripples
  float ringR = mix(0.0, 1.4, smoothstep(0.0, 0.4, coal));
  float ring = exp(-pow((length(uv) - ringR)/0.06, 2.0)) * coal * (1.0 - smoothstep(0.0, 1.3, length(uv)));
  col += ring * vec3(0.55, 0.85, 1.10) * 1.0;

  return col;
}

// =============================================================
// MAIN — dispatch + smooth cross-fade + cinematic post-FX
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

  // Subtle camera parallax from cursor
  uv += (uMouse - 0.5) * 0.012;

  float aIdx = clamp(uActIndex, 0.0, max(uActCount - 0.001, 0.0));
  int   ai   = int(floor(aIdx));
  float p    = fract(aIdx);

  vec3 col;
  if(uReduced > 0.5){
    col = deepSky(uv) * 0.9;
  } else {
    col = dispatchAct(ai, uv, p);
    if(p > 0.88 && ai+1 < int(uActCount)){
      float blend = smoothstep(0.88, 1.0, p);
      vec3 nxt = dispatchAct(ai+1, uv, 0.0);
      col = mix(col, nxt, blend * 0.65);
    }
  }

  // Cinematic vignette
  col *= 1.0 - 0.32 * pow(length(uv*vec2(0.9,1.0)), 2.4);

  // Cheap chromatic aberration toward edges
  float ca = length(uv) * 0.0026;
  vec2 dir = normalize(uv + 1e-5);
  vec3 caCol;
  caCol.r = dispatchAct(ai, uv - dir*ca, p).r;
  caCol.g = col.g;
  caCol.b = dispatchAct(ai, uv + dir*ca, p).b;
  col = mix(col, caCol, 0.18);

  // Filmic tonemap (Reinhard-extended)
  col = col / (1.0 + col);
  // Subtle gain in midtones, gamma
  col = pow(col, vec3(0.82));

  // Film grain
  float grain = hash12(gl_FragCoord.xy + uTime*60.0) - 0.5;
  col += grain * 0.012;

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
