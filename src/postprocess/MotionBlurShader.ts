import * as THREE from 'three'

export const MotionBlurShader: THREE.ShaderMaterial['userData'] = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.5 },
    center: { value: new THREE.Vector2(0.5, 0.5) }
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform vec2 center;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - center;
      float dist = length(dir);

      vec4 color = vec4(0.0);
      float totalWeight = 0.0;

      // 8-sample radial blur
      for(int i = 0; i < 8; i++) {
        float t = float(i) / 8.0;
        float weight = 1.0 - t * 0.5;
        vec2 offset = dir * intensity * t * 0.5;
        color += texture2D(tDiffuse, vUv - offset) * weight;
        totalWeight += weight;
      }

      gl_FragColor = color / totalWeight;
    }
  `
}
