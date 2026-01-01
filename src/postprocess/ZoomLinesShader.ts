import * as THREE from 'three'

/**
 * 集中線シェーダー
 * 画面中心から放射状に線を描画し、加速感を演出する
 */
export const ZoomLinesShader: THREE.ShaderMaterial['userData'] = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.0 },
    center: { value: new THREE.Vector2(0.5, 0.5) },
    lineCount: { value: 60.0 },
    lineWidth: { value: 0.015 },
    lineColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) }
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
    uniform float lineCount;
    uniform float lineWidth;
    uniform vec3 lineColor;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // 中心からの方向と距離
      vec2 dir = vUv - center;
      float angle = atan(dir.y, dir.x);
      float dist = length(dir);

      // 放射状の線パターンを生成
      // sin関数で周期的なパターンを作成
      float linePattern = abs(sin(angle * lineCount));

      // 線の鮮明さを調整（smoothstepで線の幅を制御）
      float line = smoothstep(1.0 - lineWidth, 1.0, linePattern);

      // 中心から離れるほど線が強くなる（中心は線が見えない）
      float radialFade = smoothstep(0.1, 0.6, dist);

      // 外側ほど線が細くなる
      float outerFade = 1.0 - smoothstep(0.5, 0.9, dist);

      // 最終的な線のマスク
      float lineMask = line * radialFade * outerFade * intensity;

      // 元の画像に白い線を合成
      color.rgb = mix(color.rgb, lineColor, lineMask * 0.6);

      // 若干の放射状ブラーも追加（加速感を強調）
      if (intensity > 0.1) {
        vec4 blurColor = vec4(0.0);
        float blurSamples = 4.0;
        for(float i = 0.0; i < 4.0; i++) {
          float t = i / blurSamples;
          vec2 offset = dir * intensity * t * 0.1;
          blurColor += texture2D(tDiffuse, vUv - offset);
        }
        blurColor /= blurSamples;
        color = mix(color, blurColor, intensity * 0.3);
      }

      gl_FragColor = color;
    }
  `
}
