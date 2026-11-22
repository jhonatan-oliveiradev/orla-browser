'use client';

import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

export function ScrollTrack() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 29, mass: 0.3 });
  return <motion.div className="scroll-track" style={{ scaleX }} aria-hidden="true" />;
}

export function Enter({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: .15, y: 18, filter: 'blur(2px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.16, margin: '0px 0px -40px 0px' }}
      transition={{ duration: reduced ? 0 : .66, delay: reduced ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const lines = [
  <>Você não trabalha</>,
  <>em <span className="hero-cross">abas.</span></>,
  <>Trabalha em <em>projetos.</em></>,
];

export function HeroTitle() {
  const reduced = useReducedMotion();
  return (
    <h1 className="new-hero-title">
      {lines.map((line, index) => (
        <span className="hero-line-mask" key={index}>
          <motion.span
            className="hero-line"
            initial={reduced ? false : { y: '115%', rotate: 2, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: reduced ? 0 : 1.12, delay: reduced ? 0 : 0.15 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

const vertexSource = [
  '#version 300 es',
  'in vec2 a_position;',
  'void main() { gl_Position = vec4(a_position, 0.0, 1.0); }',
].join('\n');

const fragmentSource = [
  '#version 300 es',
  'precision highp float;',
  'uniform vec2 u_resolution;',
  'uniform vec2 u_pointer;',
  'uniform float u_time;',
  'out vec4 outColor;',
  'void main() {',
  ' vec2 uv = gl_FragCoord.xy / u_resolution.xy;',
  ' float x = uv.x; float y = uv.y; float t = u_time * 0.08;',
  ' float pull = (u_pointer.x - 0.5) * 0.07;',
  ' float lineSpace = y + 0.08 * sin(x * 3.7 + t * 0.65) + 0.025 * sin(x * 13.0 - t)',
  '                 + 0.015 * sin(x * 27.0 + t * 0.33) + pull;',
  ' float contour = 1.0 - smoothstep(0.0, 0.041, abs(sin(lineSpace * 90.0)));',
  ' float horizon = 1.0 - smoothstep(0.0, 0.17, abs(y - (0.42 + 0.14 * sin(x * 3.2 + t * 0.24))));',
  ' float fadeX = smoothstep(0.12, 0.68, x);',
  ' float fadeY = smoothstep(0.07, 0.33, y) * (1.0 - smoothstep(0.86, 1.0, y));',
  ' float fade = fadeX * fadeY;',
  ' vec3 mint = vec3(0.77, 0.93, 0.59);',
  ' vec3 blue = vec3(0.37, 0.56, 0.54);',
  ' vec3 ink = mix(blue, mint, smoothstep(0.18, 0.94, x));',
  ' float alpha = (contour * 0.21 + horizon * 0.045) * fade;',
  ' outColor = vec4(ink, alpha);',
  '}',
].join('\n');

function createShader(gl: WebGL2RenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** The contour field only renders while visible, with reduced-motion and CSS fallbacks. */
export function HorizonField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return;

    const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return;
    }
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const pointer = gl.getUniformLocation(program, 'u_pointer');
    const time = gl.getUniformLocation(program, 'u_time');
    gl.useProgram(program);

    let frameId = 0;
    let visible = true;
    let disposed = false;
    const position = { x: 0.5, y: 0.5 };
    const origin = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (width !== canvas.width || height !== canvas.height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };
    const render = (timestamp: number) => {
      frameId = 0;
      if (disposed || !visible || document.hidden) return;
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(pointer, position.x, position.y);
      gl.uniform1f(time, reduced ? 0 : (timestamp - origin) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduced) frameId = window.requestAnimationFrame(render);
    };
    const start = () => {
      if (!frameId && visible && !document.hidden) frameId = window.requestAnimationFrame(render);
    };
    const stop = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    };
    const onMove = (event: PointerEvent) => {
      position.x = event.clientX / window.innerWidth;
      position.y = event.clientY / window.innerHeight;
    };
    const onVisibility = () => document.hidden ? stop() : start();
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    });
    intersection.observe(canvas);
    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) start();
    });
    observer.observe(canvas);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      disposed = true;
      stop();
      intersection.disconnect();
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [reduced]);

  return <canvas className="horizon-field" ref={canvasRef} aria-hidden="true" />;
}
