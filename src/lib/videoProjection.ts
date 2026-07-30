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

const getPrimaryProjection = (): VideoProjectionState | undefined => {
  return activeProjections.values().next().value;
};

const projectionVertexShaderChunk = /* glsl */ `
uniform mat4 uVideoProjectorMatrix;
varying vec4 vVideoProjectionClipPosition;
varying vec3 vVideoProjectionWorldPos;
varying vec3 vVideoProjectionWorldNormal;
`;

const projectionShaderChunk = /* glsl */ `
uniform int uVideoProjectionEnabled;
uniform sampler2D uVideoProjectionMap;
uniform sampler2D uVideoProjectionDepthMap;
uniform vec2 uVideoProjBL;
uniform vec2 uVideoProjBR;
uniform vec2 uVideoProjTR;
uniform vec2 uVideoProjTL;
uniform float uVideoProjectionOpacity;
uniform float uVideoProjectionIntensity;
uniform vec3 uVideoProjectorPosition;
varying vec4 vVideoProjectionClipPosition;
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

vec3 sampleVideoProjection() {
  if (uVideoProjectionEnabled == 0) return vec3(0.0);

  // Only surfaces facing the projector can receive the image.
  vec3 toSurface = normalize(vVideoProjectionWorldPos - uVideoProjectorPosition);
  vec3 surfaceNormal = normalize(vVideoProjectionWorldNormal);
  if (dot(surfaceNormal, toSurface) > -0.02) return vec3(0.0);

  vec4 clip = vVideoProjectionClipPosition;
  if (clip.w <= 0.0) return vec3(0.0);

  vec3 ndc = clip.xyz / clip.w;
  if (ndc.x < -1.0 || ndc.x > 1.0 || ndc.y < -1.0 || ndc.y > 1.0 || ndc.z < -1.0 || ndc.z > 1.0) {
    return vec3(0.0);
  }

  vec2 projectionUv = ndc.xy * 0.5 + 0.5;
  vec2 videoUv = videoProjectionInvBilinear(projectionUv, uVideoProjBL, uVideoProjBR, uVideoProjTR, uVideoProjTL);
  if (videoUv.x < 0.0 || videoUv.x > 1.0 || videoUv.y < 0.0 || videoUv.y > 1.0) {
    return vec3(0.0);
  }

  float projectedDepth = ndc.z * 0.5 + 0.5;
  float nearestDepth = texture2D(uVideoProjectionDepthMap, projectionUv).r;
  float hasNearestSurface = 1.0 - step(0.99999, nearestDepth);
  float visibleFromProjector = hasNearestSurface * step(projectedDepth - 0.004, nearestDepth);
  vec3 videoColor = texture2D(uVideoProjectionMap, vec2(videoUv.x, 1.0 - videoUv.y)).rgb;
  return videoColor * visibleFromProjector * uVideoProjectionOpacity * uVideoProjectionIntensity;
}
`;

type ProjectionShader = THREE.WebGLProgramParametersWithUniforms['uniforms'] & {
  uVideoProjectionEnabled: { value: number };
  uVideoProjectionMap: { value: THREE.Texture };
  uVideoProjectionDepthMap: { value: THREE.Texture };
  uVideoProjectorMatrix: { value: THREE.Matrix4 };
  uVideoProjBL: { value: THREE.Vector2 };
  uVideoProjBR: { value: THREE.Vector2 };
  uVideoProjTR: { value: THREE.Vector2 };
  uVideoProjTL: { value: THREE.Vector2 };
  uVideoProjectionOpacity: { value: number };
  uVideoProjectionIntensity: { value: number };
  uVideoProjectorPosition: { value: THREE.Vector3 };
};

export const patchVideoProjectionMaterial = (material: THREE.MeshStandardMaterial) => {
  if (material.userData.videoProjectionPatched) return;

  material.userData.videoProjectionPatched = true;
  material.customProgramCacheKey = () => 'video-projection-facing-v4';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uVideoProjectionEnabled = { value: 0 };
    shader.uniforms.uVideoProjectionMap = { value: emptyTexture };
    shader.uniforms.uVideoProjectionDepthMap = { value: emptyTexture };
    shader.uniforms.uVideoProjectorMatrix = { value: new THREE.Matrix4() };
    shader.uniforms.uVideoProjBL = { value: new THREE.Vector2(0, 0) };
    shader.uniforms.uVideoProjBR = { value: new THREE.Vector2(1, 0) };
    shader.uniforms.uVideoProjTR = { value: new THREE.Vector2(1, 1) };
    shader.uniforms.uVideoProjTL = { value: new THREE.Vector2(0, 1) };
    shader.uniforms.uVideoProjectionOpacity = { value: 1 };
    shader.uniforms.uVideoProjectionIntensity = { value: 1.35 };
    shader.uniforms.uVideoProjectorPosition = { value: new THREE.Vector3() };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${projectionVertexShaderChunk}`)
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvVideoProjectionClipPosition = uVideoProjectorMatrix * (modelMatrix * vec4(transformed, 1.0));'
      )
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

  const projection = getPrimaryProjection();
  uniforms.uVideoProjectionEnabled.value = projection?.enabled ? 1 : 0;
  if (!projection) return;

  uniforms.uVideoProjectionMap.value = projection.videoTexture;
  uniforms.uVideoProjectionDepthMap.value = projection.depthTexture;
  uniforms.uVideoProjectorMatrix.value.copy(projection.projectorMatrix);
  uniforms.uVideoProjBL.value.copy(projection.corners.bl);
  uniforms.uVideoProjBR.value.copy(projection.corners.br);
  uniforms.uVideoProjTR.value.copy(projection.corners.tr);
  uniforms.uVideoProjTL.value.copy(projection.corners.tl);
  uniforms.uVideoProjectionOpacity.value = projection.opacity;
  uniforms.uVideoProjectionIntensity.value = projection.intensity;
  uniforms.uVideoProjectorPosition.value.copy(projection.projectorPosition);
};