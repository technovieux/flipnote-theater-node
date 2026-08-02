import * as THREE from 'three';

export interface VideoProjectionState {
  id: string;
  enabled: boolean;
  projectorMatrix: THREE.Matrix4;
  videoTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  opacity: number;
  intensity: number;
  projectorPosition: THREE.Vector3;
  near: number;
  far: number;
  corners: {
    bl: THREE.Vector2;
    br: THREE.Vector2;
    tr: THREE.Vector2;
    tl: THREE.Vector2;
  };
}

const emptyTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
emptyTexture.needsUpdate = true;

const activeProjections = new Map<string, VideoProjectionState>();

export const setVideoProjection = (projection: VideoProjectionState) => {
  activeProjections.set(projection.id, projection);
};

export const removeVideoProjection = (id: string) => {
  activeProjections.delete(id);
};

export const MAX_VIDEO_PROJECTORS = 4;

const getProjections = (): VideoProjectionState[] =>
  Array.from(activeProjections.values()).slice(0, MAX_VIDEO_PROJECTORS);

const projectionVertexShaderChunk = /* glsl */ `
varying vec3 vVideoProjectionWorldPos;
varying vec3 vVideoProjectionWorldNormal;
`;

const projectionShaderChunk = /* glsl */ `
#define MAX_VIDEO_PROJECTORS ${MAX_VIDEO_PROJECTORS}
uniform int uVideoProjectionCount;
uniform int uVideoProjectionEnabled[MAX_VIDEO_PROJECTORS];
uniform sampler2D uVideoProjectionMap[MAX_VIDEO_PROJECTORS];
uniform sampler2D uVideoProjectionDepthMap[MAX_VIDEO_PROJECTORS];
uniform mat4 uVideoProjectorMatrix[MAX_VIDEO_PROJECTORS];
uniform vec2 uVideoProjBL[MAX_VIDEO_PROJECTORS];
uniform vec2 uVideoProjBR[MAX_VIDEO_PROJECTORS];
uniform vec2 uVideoProjTR[MAX_VIDEO_PROJECTORS];
uniform vec2 uVideoProjTL[MAX_VIDEO_PROJECTORS];
uniform float uVideoProjectionOpacity[MAX_VIDEO_PROJECTORS];
uniform float uVideoProjectionIntensity[MAX_VIDEO_PROJECTORS];
uniform vec3 uVideoProjectorPosition[MAX_VIDEO_PROJECTORS];
uniform float uVideoProjectionNear[MAX_VIDEO_PROJECTORS];
uniform float uVideoProjectionFar[MAX_VIDEO_PROJECTORS];
varying vec3 vVideoProjectionWorldPos;
varying vec3 vVideoProjectionWorldNormal;

vec2 videoProjectionInvBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  vec2 e = b - a;
  vec2 f = d - a;
  vec2 g = a - b + c - d;
  vec2 h = p - a;
  float k2 = g.x * f.y - g.y * f.x;
  float k1 = e.x * f.y - e.y * f.x + h.x * g.y - h.y * g.x;
  float k0 = h.x * e.y - h.y * e.x;
  float v;
  if (abs(k2) < 1e-5) {
    v = (abs(k1) < 1e-5) ? -1.0 : (-k0 / k1);
  } else {
    float w = k1 * k1 - 4.0 * k0 * k2;
    if (w < 0.0) return vec2(-1.0);
    w = sqrt(w);
    float v1 = (-k1 - w) / (2.0 * k2);
    float v2 = (-k1 + w) / (2.0 * k2);
    v = (v1 >= 0.0 && v1 <= 1.0) ? v1 : v2;
  }
  vec2 den = e + g * v;
  float u = (abs(den.x) > abs(den.y)) ? (h.x - f.x * v) / den.x : (h.y - f.y * v) / den.y;
  return vec2(u, v);
}

float videoProjectionLinearDepth(float depth, float near, float far) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}

// GLSL ES forbids indexing sampler arrays with a non-constant expression, so the
// projector loop is unrolled with literal indices (otherwise only index 0 works).
#define VIDEO_PROJECTION_STEP(i) \
  if (i < uVideoProjectionCount && uVideoProjectionEnabled[i] == 1) { \
    vec3 toSurface = normalize(vVideoProjectionWorldPos - uVideoProjectorPosition[i]); \
    vec4 clip = uVideoProjectorMatrix[i] * vec4(vVideoProjectionWorldPos, 1.0); \
    if (dot(surfaceNormal, toSurface) <= -0.02 && clip.w > 0.0) { \
      vec3 ndc = clip.xyz / clip.w; \
      if (abs(ndc.x) <= 1.0 && abs(ndc.y) <= 1.0 && abs(ndc.z) <= 1.0) { \
        vec2 projectionUv = ndc.xy * 0.5 + 0.5; \
        vec2 videoUv = videoProjectionInvBilinear(projectionUv, uVideoProjBL[i], uVideoProjBR[i], uVideoProjTR[i], uVideoProjTL[i]); \
        if (videoUv.x >= 0.0 && videoUv.x <= 1.0 && videoUv.y >= 0.0 && videoUv.y <= 1.0) { \
          float projectedDepth = ndc.z * 0.5 + 0.5; \
          float nearestDepth = texture2D(uVideoProjectionDepthMap[i], projectionUv).r; \
          float hasNearestSurface = 1.0 - step(0.99999, nearestDepth); \
          float projectedLinear = videoProjectionLinearDepth(projectedDepth, uVideoProjectionNear[i], uVideoProjectionFar[i]); \
          float nearestLinear = videoProjectionLinearDepth(nearestDepth, uVideoProjectionNear[i], uVideoProjectionFar[i]); \
          float visibleFromProjector = hasNearestSurface * step(projectedLinear - 0.02, nearestLinear); \
          vec3 videoColor = texture2D(uVideoProjectionMap[i], vec2(videoUv.x, 1.0 - videoUv.y)).rgb; \
          total += videoColor * visibleFromProjector * uVideoProjectionOpacity[i] * uVideoProjectionIntensity[i]; \
        } \
      } \
    } \
  }

vec3 sampleVideoProjection() {
  vec3 total = vec3(0.0);
  vec3 surfaceNormal = normalize(vVideoProjectionWorldNormal);

  VIDEO_PROJECTION_STEP(0)
  VIDEO_PROJECTION_STEP(1)
  VIDEO_PROJECTION_STEP(2)
  VIDEO_PROJECTION_STEP(3)

  return total;
}
`;

type ProjectionShader = THREE.WebGLProgramParametersWithUniforms['uniforms'] & {
  uVideoProjectionCount: { value: number };
  uVideoProjectionEnabled: { value: number[] };
  uVideoProjectionMap: { value: THREE.Texture[] };
  uVideoProjectionDepthMap: { value: THREE.Texture[] };
  uVideoProjectorMatrix: { value: THREE.Matrix4[] };
  uVideoProjBL: { value: THREE.Vector2[] };
  uVideoProjBR: { value: THREE.Vector2[] };
  uVideoProjTR: { value: THREE.Vector2[] };
  uVideoProjTL: { value: THREE.Vector2[] };
  uVideoProjectionOpacity: { value: number[] };
  uVideoProjectionIntensity: { value: number[] };
  uVideoProjectorPosition: { value: THREE.Vector3[] };
  uVideoProjectionNear: { value: number[] };
  uVideoProjectionFar: { value: number[] };
};

const fill = <T,>(factory: (i: number) => T): T[] =>
  Array.from({ length: MAX_VIDEO_PROJECTORS }, (_, i) => factory(i));

export const patchVideoProjectionMaterial = (material: THREE.MeshStandardMaterial) => {
  if (material.userData.videoProjectionPatched) return;

  material.userData.videoProjectionPatched = true;
  material.customProgramCacheKey = () => 'video-projection-multi-v7';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uVideoProjectionCount = { value: 0 };
    shader.uniforms.uVideoProjectionEnabled = { value: fill(() => 0) };
    shader.uniforms.uVideoProjectionMap = { value: fill(() => emptyTexture) };
    shader.uniforms.uVideoProjectionDepthMap = { value: fill(() => emptyTexture) };
    shader.uniforms.uVideoProjectorMatrix = { value: fill(() => new THREE.Matrix4()) };
    shader.uniforms.uVideoProjBL = { value: fill(() => new THREE.Vector2(0, 0)) };
    shader.uniforms.uVideoProjBR = { value: fill(() => new THREE.Vector2(1, 0)) };
    shader.uniforms.uVideoProjTR = { value: fill(() => new THREE.Vector2(1, 1)) };
    shader.uniforms.uVideoProjTL = { value: fill(() => new THREE.Vector2(0, 1)) };
    shader.uniforms.uVideoProjectionOpacity = { value: fill(() => 1) };
    shader.uniforms.uVideoProjectionIntensity = { value: fill(() => 1.35) };
    shader.uniforms.uVideoProjectorPosition = { value: fill(() => new THREE.Vector3()) };
    shader.uniforms.uVideoProjectionNear = { value: fill(() => 0.2) };
    shader.uniforms.uVideoProjectionFar = { value: fill(() => 8) };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${projectionVertexShaderChunk}`)
      .replace(
        '#include <defaultnormal_vertex>',
        '#include <defaultnormal_vertex>\nvVideoProjectionWorldNormal = mat3(modelMatrix) * objectNormal;\nvVideoProjectionWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;'
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${projectionShaderChunk}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += sampleVideoProjection();');

    material.userData.videoProjectionUniforms = shader.uniforms;
  };
};

export const updateVideoProjectionMaterial = (material: THREE.MeshStandardMaterial) => {
  const uniforms = material.userData.videoProjectionUniforms as ProjectionShader | undefined;
  if (!uniforms) return;

  const projections = getProjections();
  uniforms.uVideoProjectionCount.value = projections.length;

  for (let i = 0; i < MAX_VIDEO_PROJECTORS; i++) {
    const projection = projections[i];
    if (!projection) {
      uniforms.uVideoProjectionEnabled.value[i] = 0;
      uniforms.uVideoProjectionMap.value[i] = emptyTexture;
      uniforms.uVideoProjectionDepthMap.value[i] = emptyTexture;
      continue;
    }
    uniforms.uVideoProjectionEnabled.value[i] = projection.enabled ? 1 : 0;
    uniforms.uVideoProjectionMap.value[i] = projection.videoTexture;
    uniforms.uVideoProjectionDepthMap.value[i] = projection.depthTexture;
    uniforms.uVideoProjectorMatrix.value[i].copy(projection.projectorMatrix);
    uniforms.uVideoProjBL.value[i].copy(projection.corners.bl);
    uniforms.uVideoProjBR.value[i].copy(projection.corners.br);
    uniforms.uVideoProjTR.value[i].copy(projection.corners.tr);
    uniforms.uVideoProjTL.value[i].copy(projection.corners.tl);
    uniforms.uVideoProjectionOpacity.value[i] = projection.opacity;
    uniforms.uVideoProjectionIntensity.value[i] = projection.intensity;
    uniforms.uVideoProjectorPosition.value[i].copy(projection.projectorPosition);
    uniforms.uVideoProjectionNear.value[i] = projection.near;
    uniforms.uVideoProjectionFar.value[i] = projection.far;
  }
};