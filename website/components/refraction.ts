const vertex = `
  attribute vec2 point;
  void main() { gl_Position = vec4(point, 0.0, 1.0); }
`;

const fragment = `
  precision mediump float;
  uniform vec2 resolution;
  uniform vec2 cursor;
  uniform float time;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 p = (uv - vec2(.77, .47)) * vec2(resolution.x / resolution.y, 1.);
    p -= cursor * .045;
    float angle = atan(p.y, p.x);
    float r = length(p);
    float bands = exp(-55. * abs(r - .29)) + .55 * exp(-40. * abs(r - .44));
    float streak = pow(.5 + .5 * sin(angle * 3. - time * .72), 10.);
    float alpha = bands * streak * .27 * smoothstep(.43, .69, uv.x);
    vec3 tint = mix(vec3(.81, .65, 1.), vec3(.83, 1., .48), .5 + .5 * cos(angle));
    gl_FragColor = vec4(tint, alpha);
  }
`;

export function mountRefraction(canvas: HTMLCanvasElement, target: HTMLElement) {
  const context = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!context) return;
  const gl = context;

  function compile(type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (program && vs && fs) {
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return;
  }

  const buffer = gl.createBuffer();
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const point = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(point);
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'resolution');
  const cursor = gl.getUniformLocation(program, 'cursor');
  const time = gl.getUniformLocation(program, 'time');

  let frame = 0;
  let visible = false;
  let ready = true;
  let last = 0;
  let elapsed = 0;
  let x = 0;
  let y = 0;
  let aimX = 0;
  let aimY = 0;

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    const scale = Math.min(.62, 960 / Math.max(1, width), 430 / Math.max(1, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
  }

  function render(now: number) {
    if (!last || now - last > 37) {
      elapsed += last ? Math.min(now - last, 90) : 0;
      last = now;
      x += (aimX - x) * .13;
      y += (aimY - y) * .13;
      gl.uniform2f(cursor, x, y);
      gl.uniform1f(time, elapsed / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    frame = requestAnimationFrame(render);
  }

  function sync() {
    const shouldRun = visible && ready && !document.hidden;
    if (shouldRun && !frame) frame = requestAnimationFrame(render);
    if (!shouldRun) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    }
  }

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  const sizes = new ResizeObserver(resize);
  const pointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = target.getBoundingClientRect();
    aimX = (event.clientX - bounds.left) / bounds.width - .5;
    aimY = .5 - (event.clientY - bounds.top) / bounds.height;
  };
  const reset = () => { aimX = 0; aimY = 0; };
  const lost = () => { ready = false; sync(); };
  intersection.observe(canvas);
  sizes.observe(canvas);
  target.addEventListener('pointermove', pointer, { passive: true });
  target.addEventListener('pointerleave', reset);
  canvas.addEventListener('webglcontextlost', lost);
  document.addEventListener('visibilitychange', sync);
  resize();
  return () => {
    cancelAnimationFrame(frame);
    intersection.disconnect();
    sizes.disconnect();
    target.removeEventListener('pointermove', pointer);
    target.removeEventListener('pointerleave', reset);
    canvas.removeEventListener('webglcontextlost', lost);
    document.removeEventListener('visibilitychange', sync);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };
}
