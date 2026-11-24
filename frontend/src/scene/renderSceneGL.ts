import type { SceneCrop } from './sceneFrame'

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

// One still and one mask texture. Red marks water (0 at the waterline, 1 in open water),
// green weights swaying foliage/lanterns (0 at the base, 1 at tips), and blue weights warm
// ambient glow breathing (lanterns, moon sheen). Everything else is untouched.
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uMasks;
uniform vec4 uCrop;
uniform float uTime;
uniform vec4 uMotion;
uniform vec3 uMistColor;
uniform vec3 uGlowColor;

in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = uCrop.xy + vUv * uCrop.zw;
  vec3 masks = texture(uMasks, uv).rgb;

  // Foliage / lantern sway: each strand sways on its own phase; the tips lead and roots stay put.
  float gust = 0.62 + 0.38 * sin(uTime * 0.31 + uv.x * 2.4);
  float strand = uv.x * 21.0;
  float sway =
    sin(uTime * 0.95 + strand) * 0.55 +
    sin(uTime * 0.57 + strand * 2.3 + uv.y * 5.0) * 0.3 +
    sin(uTime * 1.7 + strand * 0.6) * 0.15;
  vec2 willow = vec2(sway * 0.0082, abs(sway) * -0.0014) * gust * masks.g * uMotion.y;

  // Water: thin horizontal ripples that widen towards the viewer.
  float depth = smoothstep(0.58, 1.0, uv.y);
  float near = mix(0.55, 1.7, depth);
  float rippleX =
    sin(uv.y * 240.0 / near - uTime * 1.25 + noise(uv * 9.0) * 4.0) * 0.0016 +
    sin(uv.y * 96.0 / near + uTime * 0.72 + uv.x * 5.0) * 0.0019;
  float rippleY = sin(uv.y * 150.0 / near - uTime * 0.9 + uv.x * 3.0) * 0.0008;
  vec2 water = vec2(rippleX, rippleY) * near * masks.r * uMotion.x;

  vec3 color = texture(uScene, uv - willow + water).rgb;

  // A faint moving sheen on the water, then slow mist drifting across the far bank.
  float sheen = fbm(vec2(uv.x * 5.0 + uTime * 0.03, uv.y * 30.0 - uTime * 0.05));
  color += (sheen - 0.5) * 0.05 * masks.r * uMotion.x;

  float band = smoothstep(0.26, 0.46, uv.y) * (1.0 - smoothstep(0.56, 0.72, uv.y));
  float mist = fbm(vec2(uv.x * 2.6 - uTime * 0.014, uv.y * 5.0 + uTime * 0.004));
  color = mix(color, uMistColor, smoothstep(0.42, 0.85, mist) * band * 0.22 * uMotion.z);

  // Natural dual-frequency candlelight / moonlight breathing weighted by the blue mask channel,
  // plus gentle warm reflection shimmer dancing on rippled water when glow is active.
  float slowBreath = 0.5 + 0.5 * sin(uTime * 1.15 + uv.x * 7.3 + uv.y * 5.1);
  float candleFlicker = 0.5 + 0.5 * sin(uTime * 2.65 + uv.x * 15.2 - uv.y * 9.4);
  float glowPulse = mix(slowBreath, candleFlicker, 0.28);
  color += uGlowColor * (0.045 + 0.105 * glowPulse) * masks.b * uMotion.w;

  float waterGlint = smoothstep(0.56, 0.88, sheen) * masks.r * uMotion.x * uMotion.w;
  color += uGlowColor * waterGlint * 0.065;

  outColor = vec4(color, 1.0);
}`

export interface SceneGLOptions {
  /** Multiplier for R-channel water ripple motion (default 1). */
  waterAmp?: number
  /** Multiplier for G-channel foliage/lantern sway (default 1). */
  foliageAmp?: number
  /** Multiplier for mid-horizon drifting mist band (default 1). */
  mistAmp?: number
  /** Multiplier for B-channel warm lantern/moon breathing glow (default 0). */
  glowAmp?: number
  /** Normalized RGB mist color (default [0.9, 0.93, 0.91]). */
  mistColor?: readonly [number, number, number]
  /** Normalized RGB glow color (default [1.0, 0.82, 0.48]). */
  glowColor?: readonly [number, number, number]
}

export interface SceneGLRenderer {
  dispose: () => void
  /** Milliseconds one frame really costs the GPU, measured by forcing it to finish. */
  measureFrameMs: () => number
  render: (timeSeconds: number) => void
  resize: (pixelWidth: number, pixelHeight: number, crop: SceneCrop) => void
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Scene shader failed to compile: ${log}`)
  }
  return shader
}

function upload(gl: WebGL2RenderingContext, unit: number, image: TexImageSource) {
  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return texture
}

/** Builds the WebGL2 layer. Throws when WebGL2 or the shaders are unavailable. */
export function createSceneGLRenderer(
  canvas: HTMLCanvasElement,
  scene: TexImageSource,
  masks: TexImageSource,
  options?: SceneGLOptions,
): SceneGLRenderer {
  const waterAmp = options?.waterAmp ?? 1
  const foliageAmp = options?.foliageAmp ?? 1
  const mistAmp = options?.mistAmp ?? 1
  const glowAmp = options?.glowAmp ?? 0
  const mistColor = options?.mistColor ?? ([0.9, 0.93, 0.91] as const)
  const glowColor = options?.glowColor ?? ([1.0, 0.82, 0.48] as const)

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'low-power',
    stencil: false,
  })
  if (!gl) throw new Error('WebGL2 is unavailable')

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  let fragment: WebGLShader
  try {
    fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  } catch (error) {
    gl.deleteShader(vertex)
    throw error
  }
  const program = gl.createProgram()
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Scene program failed to link: ${log}`)
  }

  const vertexArray = gl.createVertexArray()
  const buffer = gl.createBuffer()
  gl.bindVertexArray(vertexArray)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  // One oversized triangle covers the viewport without a diagonal seam.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const sceneTexture = upload(gl, 0, scene)
  const maskTexture = upload(gl, 1, masks)

  gl.useProgram(program)
  gl.uniform1i(gl.getUniformLocation(program, 'uScene'), 0)
  gl.uniform1i(gl.getUniformLocation(program, 'uMasks'), 1)
  gl.uniform4f(
    gl.getUniformLocation(program, 'uMotion'),
    waterAmp,
    foliageAmp,
    mistAmp,
    glowAmp,
  )
  gl.uniform3f(
    gl.getUniformLocation(program, 'uMistColor'),
    mistColor[0],
    mistColor[1],
    mistColor[2],
  )
  gl.uniform3f(
    gl.getUniformLocation(program, 'uGlowColor'),
    glowColor[0],
    glowColor[1],
    glowColor[2],
  )
  const cropLocation = gl.getUniformLocation(program, 'uCrop')
  const timeLocation = gl.getUniformLocation(program, 'uTime')

  const render = (timeSeconds: number) => {
    // Rebind every frame: the context belongs to the canvas, not to this renderer.
    gl.useProgram(program)
    gl.bindVertexArray(vertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, maskTexture)
    gl.uniform1f(timeLocation, timeSeconds)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  return {
    dispose() {
      gl.deleteTexture(sceneTexture)
      gl.deleteTexture(maskTexture)
      gl.deleteBuffer(buffer)
      gl.deleteVertexArray(vertexArray)
      gl.deleteProgram(program)
    },
    measureFrameMs() {
      const pixel = new Uint8Array(4)
      const drawAndWait = (time: number) => {
        render(time)
        // Reading a pixel back blocks until the frame is done; this runs only at start-up.
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      }
      drawAndWait(0)
      const samples = 3
      const started = performance.now()
      for (let index = 1; index <= samples; index += 1) drawAndWait(index / 30)
      return (performance.now() - started) / samples
    },
    render,
    resize(pixelWidth, pixelHeight, crop) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      gl.viewport(0, 0, pixelWidth, pixelHeight)
      gl.useProgram(program)
      gl.uniform4f(cropLocation, crop.offsetX, crop.offsetY, crop.scaleX, crop.scaleY)
    },
  }
}
