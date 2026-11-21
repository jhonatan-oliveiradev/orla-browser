'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import Image from 'next/image';

export function HeroScene() {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const reduce = useReducedMotion();
  const tx = useSpring(x, { stiffness: 72, damping: 24 });
  const ty = useSpring(y, { stiffness: 72, damping: 24 });

  useEffect(() => {
    const target = stage.current?.parentElement;
    if (!target || reduce || !window.matchMedia('(pointer: fine)').matches) return;
    const move = (event: PointerEvent) => {
      const bounds = target.getBoundingClientRect();
      x.set((event.clientX - bounds.left) / bounds.width * 24 - 12);
      y.set((event.clientY - bounds.top) / bounds.height * 28 - 14);
    };
    const reset = () => { x.set(0); y.set(0); };
    target.addEventListener('pointermove', move, { passive: true });
    target.addEventListener('pointerleave', reset);
    return () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerleave', reset);
      reset();
    };
  }, [x, y, reduce]);

  useEffect(() => {
    const target = stage.current?.parentElement;
    const layer = canvas.current;
    if (!target || !layer || reduce || !window.matchMedia('(min-width: 820px) and (pointer: fine)').matches) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      void import('./refraction').then(({ mountRefraction }) => {
        if (!disposed) cleanup = mountRefraction(layer, target);
      }).catch(() => { /* The optimized still image remains visible. */ });
    }, 380);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [reduce]);

  return (
    <div ref={stage} className="hero-scene" aria-hidden="true">
      <motion.div className="hero-art" style={{ x: tx, y: ty }}>
        <Image src="/orbit.webp" alt="" fill preload sizes="100vw" />
      </motion.div>
      <canvas ref={canvas} className="hero-refraction" />
      <div className="hero-shade" />
    </div>
  );
}
