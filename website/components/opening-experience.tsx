'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HeroTheatre } from './hero-theatre';

type IntroPhase = 'boot' | 'center' | 'split' | 'dock' | 'reveal' | 'done';
type Dimensions = {
  viewportWidth: number;
  viewportHeight: number;
  orlaWidth: number;
  orlaHeight: number;
  browserWidth: number;
  browserHeight: number;
};

const SESSION_KEY = 'orla-browser-intro-v1';
const ease = [0.16, 1, 0.3, 1] as const;

function OpeningSequence({ onReveal }: { onReveal: () => void }) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<IntroPhase>('boot');
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const orlaRef = useRef<HTMLSpanElement>(null);
  const browserRef = useRef<HTMLSpanElement>(null);
  const timeoutIds = useRef<number[]>([]);
  const previousOverflow = useRef<string | null>(null);
  const finishRef = useRef<() => void>(() => {});

  const reveal = phase === 'reveal' || phase === 'done';
  const active = phase !== 'done';

  const finish = useCallback(() => {
    timeoutIds.current.forEach((id) => window.clearTimeout(id));
    timeoutIds.current = [];
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
    try {
      window.sessionStorage.setItem(SESSION_KEY, 'seen');
    } catch {
      // Storage may be disabled. The opening still finishes normally.
    }
    onReveal();
    setPhase('done');
  }, [onReveal]);

  finishRef.current = finish;

  useEffect(() => {
    const measure = () => {
      const orla = orlaRef.current;
      const browser = browserRef.current;
      if (!orla || !browser) return;
      setDimensions({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        orlaWidth: orla.offsetWidth,
        orlaHeight: orla.offsetHeight,
        browserWidth: browser.offsetWidth,
        browserHeight: browser.offsetHeight,
      });
    };

    let mounted = true;
    measure();
    window.addEventListener('resize', measure, { passive: true });
    // Re-measure after the locally hosted typeface settles.
    void document.fonts?.ready.then(() => { if (mounted) measure(); });
    return () => {
      mounted = false;
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SESSION_KEY) === 'seen';
    } catch {
      // Private browsing may disable storage.
    }

    const shouldSkip = Boolean(reducedMotion) || seen ||
      window.location.hash.length > 0 || window.scrollY > 40;

    if (shouldSkip) {
      finishRef.current();
      return;
    }

    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setPhase('center');

    const schedule = (at: number, callback: () => void) => {
      timeoutIds.current.push(window.setTimeout(callback, at));
    };

    schedule(420, () => setPhase('split'));
    schedule(1160, () => setPhase('dock'));
    schedule(1950, () => {
      onReveal();
      setPhase('reveal');
    });
    schedule(3000, () => finishRef.current());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishRef.current();
        window.requestAnimationFrame(() => document.getElementById('hero-title')?.focus());
      }
      // Keep focus on the skip control while the visual curtain is present.
      if (event.key === 'Tab') {
        event.preventDefault();
        document.getElementById('orla-skip-opening')?.focus();
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) finishRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      timeoutIds.current.forEach((id) => window.clearTimeout(id));
      timeoutIds.current = [];
      if (previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
        previousOverflow.current = null;
      }
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [onReveal, reducedMotion]);

  const skipAndFocus = () => {
    finish();
    window.requestAnimationFrame(() => document.getElementById('hero-title')?.focus());
  };

  if (!active) return null;

  const w = dimensions?.viewportWidth ?? 1440;
  const h = dimensions?.viewportHeight ?? 900;
  const orlaW = dimensions?.orlaWidth ?? 310;
  const orlaH = dimensions?.orlaHeight ?? 94;
  const browserW = dimensions?.browserWidth ?? 450;
  const browserH = dimensions?.browserHeight ?? 94;
  const gap = Math.min(Math.max(w * .012, 10), 25);
  const mobile = w <= 680;
  const dockScale = mobile ? .76 : .58;
  const splitScale = mobile ? .7 : 1;
  const marginX = mobile ? 23 : Math.min(70, Math.max(34, w * .045));
  const marginY = mobile ? 27 : Math.min(58, Math.max(34, h * .055));
  const distance = Math.max(24, Math.min(
    w * .28,
    w / 2 - browserW * splitScale / 2 - marginX,
    w / 2 - orlaW * splitScale / 2 - marginX,
  ));

  const centered = phase === 'boot' || phase === 'center';
  const docked = phase === 'dock' || reveal;

  const orlaPosition = docked
    ? { x: -w / 2 + marginX + orlaW * dockScale / 2, y: -h / 2 + marginY + orlaH * dockScale / 2, scale: dockScale }
    : phase === 'split'
      ? { x: -distance, y: 0, scale: splitScale }
      : { x: -(browserW + gap) / 2, y: 0, scale: 1 };

  const browserPosition = docked
    ? { x: w / 2 - marginX - browserW * dockScale / 2, y: h / 2 - marginY - browserH * dockScale / 2, scale: dockScale }
    : phase === 'split'
      ? { x: distance, y: 0, scale: splitScale }
      : { x: (orlaW + gap) / 2, y: 0, scale: 1 };

  return (
    <div className="orla-opening" data-phase={phase} aria-label="Abertura do Orla Browser">
      <motion.div
        className="orla-opening-curtain orla-opening-curtain-top"
        aria-hidden="true"
        initial={false}
        animate={{ y: reveal ? '-101%' : '0%' }}
        transition={{ duration: .9, ease: [0.76, 0, .2, 1] }}
      />
      <motion.div
        className="orla-opening-curtain orla-opening-curtain-bottom"
        aria-hidden="true"
        initial={false}
        animate={{ y: reveal ? '101%' : '0%' }}
        transition={{ duration: .9, ease: [0.76, 0, .2, 1] }}
      />
      <motion.span
        className="orla-opening-word orla-opening-word-orla"
        ref={orlaRef}
        initial={false}
        animate={{
          ...orlaPosition,
          opacity: phase === 'boot' || !dimensions ? 0 : 1,
        }}
        transition={{ duration: centered ? .35 : docked ? .8 : .67, ease }}
        aria-hidden="true"
      >
        ORLA
      </motion.span>
      <motion.span
        className="orla-opening-word orla-opening-word-browser"
        ref={browserRef}
        initial={false}
        animate={{
          ...browserPosition,
          opacity: phase === 'boot' || !dimensions ? 0 : 1,
        }}
        transition={{ duration: centered ? .35 : docked ? .8 : .67, ease }}
        aria-hidden="true"
      >
        BROWSER
      </motion.span>
      <motion.span
        className="orla-opening-seam"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: phase === 'split' || phase === 'dock' ? .65 : 0, scaleX: phase === 'split' ? 1 : .2 }}
        transition={{ duration: .5, ease }}
      />
      <motion.span
        className="orla-opening-corner orla-opening-corner-a"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: docked ? (reveal ? 0 : .7) : 0 }}
        transition={{ duration: .4 }}
      />
      <motion.span
        className="orla-opening-corner orla-opening-corner-b"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: docked ? (reveal ? 0 : .7) : 0 }}
        transition={{ duration: .4 }}
      />
      <button
        type="button"
        id="orla-skip-opening"
        className="orla-opening-skip"
        onClick={skipAndFocus}
        aria-label="Pular introdução e acessar o Orla Browser"
      >
        Pular introdução <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}

/**
 * The hero is already rendered beneath the opening curtain. The transition
 * unlocks the actual product scene as the two halves move apart.
 */
export function OpeningExperience({ download }: { download: string }) {
  const [revealed, setRevealed] = useState(false);
  const showHero = useCallback(() => setRevealed(true), []);
  return (
    <>
      <OpeningSequence onReveal={showHero} />
      <HeroTheatre download={download} revealed={revealed} />
    </>
  );
}
