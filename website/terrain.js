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
    vec2 p = (uv - vec2(.52, .53)) * vec2(resolution.x / resolution.y, 1.0);
    p += cursor * .075;
    float x = p.x;
    float y = p.y;
    float drift = time * .20;
    float contour = y + .13 * sin(x * 3.5 + y * 2.5 + drift)
      + .10 * sin(x * 7.0 - y * 5.5 - drift * .62)
      + .12 * cos(x * 2.6 + y * 4.2 + drift * .36);
    float line = 1.0 - smoothstep(.015, .078, abs(fract(contour * 24.0) - .5));
    float glow = exp(-2.1 * length(p - vec2(.48, .06)));
    float edge = smoothstep(.32, .91, abs(uv.x - .5) * 2.0);
    float alpha = (line * (.17 + glow * .32) + glow * .11) * (.51 + edge * .49);
    vec3 pigment = mix(vec3(.38, .44, .20), vec3(.75, .88, .39), glow);
    gl_FragColor = vec4(pigment, alpha);
  }
`;

export function mountTerrain(canvas, motion) {
  if (motion.matches) return;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const point = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(point);
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'resolution');
  const cursor = gl.getUniformLocation(program, 'cursor');
  const time = gl.getUniformLocation(program, 'time');
  const scene = canvas.parentElement;
  let frame = 0;
  let visible = false;
  let ready = true;
  let lastDraw = -1;
  let tick = 0;
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;

  function render(now) {
    frame = 0;
    if (!visible || !ready || motion.matches || document.hidden) return;
    if (lastDraw < 0 || now - lastDraw >= 32) {
      tick += lastDraw < 0 ? 0 : Math.min(60, now - lastDraw);
      lastDraw = now;
      x += (targetX - x) * .1;
      y += (targetY - y) * .1;
      gl.uniform2f(cursor, x, y);
      gl.uniform1f(time, (tick / 1000) % 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    frame = requestAnimationFrame(render);
  }

  function update() {
    const active = visible && ready && !motion.matches && !document.hidden;
    canvas.hidden = !ready || motion.matches;
    scene.classList.toggle('has-webgl', !canvas.hidden);
    if (active && !frame) frame = requestAnimationFrame(render);
    else if (!active && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastDraw = -1;
    }
  }

  function resize() {
    const rect = scene.getBoundingClientRect();
    const scale = Math.min(1, 1200 / (rect.width || 1), 660 / (rect.height || 1));
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
  }

  new ResizeObserver(resize).observe(scene);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(scene);
  scene.parentElement.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    targetX = 2 * event.clientX / window.innerWidth - 1;
    targetY = 1 - 2 * event.clientY / window.innerHeight;
  }, { passive: true });
  scene.parentElement.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  canvas.addEventListener('webglcontextlost', () => { ready = false; update(); });
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  resize();
  update();
}
