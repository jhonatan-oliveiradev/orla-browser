'use client';

import { motion, useReducedMotion } from 'motion/react';

const paths = [
  'M70 410C152 425 164 333 258 344s116 87 210 35 117-126 184-101',
  'M70 386C148 404 180 301 272 318s102 88 199 37 118-125 181-102',
  'M70 362C155 384 189 273 282 292s101 92 199 37 118-125 171-105',
  'M70 338C160 356 197 245 292 266s100 95 199 37 118-124 161-108',
  'M70 314C167 330 205 217 303 240s100 100 201 37 112-118 148-111',
  'M70 290C174 305 213 188 315 213s100 104 201 35 110-111 136-110',
  'M70 266C181 277 220 162 325 186s99 110 205 30 105-101 122-99',
  'M70 242C189 251 231 134 339 159s96 115 205 26 100-95 108-95',
];

export function CoastEmblem() {
  const reduced = useReducedMotion();
  return (
    <figure className="coast-emblem">
      <svg viewBox="0 0 720 520" role="img" aria-labelledby="coast-title coast-description" fill="none">
        <title id="coast-title">Linhas que se encontram em uma orla</title>
        <desc id="coast-description">Oito curvas topográficas convergem ao redor do símbolo do Orla, representando diferentes projetos dentro do mesmo navegador.</desc>
        <circle cx="361" cy="254" r="225" stroke="#b9d792" strokeOpacity=".16" />
        <circle cx="361" cy="254" r="176" stroke="#b9d792" strokeOpacity=".16" />
        <circle cx="361" cy="254" r="127" stroke="#b9d792" strokeOpacity=".16" />
        <circle cx="361" cy="254" r="76" stroke="#b9d792" strokeOpacity=".16" />
        <circle cx="361" cy="254" r="4" fill="#d8fb82" />
        {paths.map((path, index) => (
          <motion.path key={index} d={path} stroke={index === 3 ? '#e7f3ba' : '#a9ce91'} strokeWidth={index === 3 ? 1.8 : 1.05}
            initial={reduced ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: .25 + index * .09 }}
            viewport={{ once: true, amount: .55 }}
            transition={{ duration: reduced ? 0 : 1.5, delay: reduced ? 0 : index * .08, ease: [.16, 1, .3, 1] }} />
        ))}
        <g stroke="#d8fb82" strokeOpacity=".9">
          <path d="M362 210v88M318 254h88" strokeOpacity=".42" />
          <circle cx="361" cy="254" r="28" strokeWidth="1.2" />
          <circle cx="361" cy="254" r="38" strokeDasharray="2 8" strokeOpacity=".3" />
        </g>
        <circle cx="537" cy="185" r="4" fill="#e2f2b6" />
        <circle cx="194" cy="356" r="3" fill="#b9dcab" />
        <path d="M537 185l47-35h67M194 356l-38 42H93" stroke="#b9d792" strokeOpacity=".55" />
        <text x="587" y="142" fill="#a4bba4" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1">CONTEXTO A</text>
        <text x="50" y="413" fill="#a4bba4" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1">CONTEXTO B</text>
      </svg>
      <figcaption>O trabalho muda de direção. O contexto permanece.</figcaption>
    </figure>
  );
}
