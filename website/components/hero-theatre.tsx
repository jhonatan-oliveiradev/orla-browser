'use client';

import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark,
  Columns2, Download, Globe2, Layers3,
  PanelLeft, Search,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, useState, type CSSProperties } from 'react';
import { HorizonField } from './motion-scenes';

type Scene = 'espacos' | 'dividir' | 'capturas';
type Space = 'estudio' | 'pesquisa';

const scenes = [
  { id: 'espacos' as const, label: 'Espaços', icon: Layers3, title: 'Um lugar para cada projeto.', description: 'Volte para o trabalho com as abas onde você as deixou.' },
  { id: 'dividir' as const, label: 'Tela dividida', icon: Columns2, title: 'Uma página ao lado da outra.', description: 'Compare, consulte e trabalhe sem trocar de janela.' },
  { id: 'capturas' as const, label: 'Capturas', icon: Bookmark, title: 'Guarde o que não quer perder.', description: 'Referências e trechos ficam ao alcance da busca.' },
];

const spaceData = {
  estudio: {
    name: 'Estúdio',
    tabs: ['Portfólio', 'Sistema visual', 'Referências'],
    heading: 'Tudo começa com uma ideia.',
    description: 'Um espaço para reunir as páginas deste projeto.',
    accent: '#d5ed95',
  },
  pesquisa: {
    name: 'Pesquisa',
    tabs: ['Artigos', 'Notas', 'Fontes'],
    heading: 'A pesquisa continua aqui.',
    description: 'As referências continuam no lugar onde você as deixou.',
    accent: '#a7d2cf',
  },
};

function BrandMark() {
  return <svg className="showcase-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M26.9 6.35a15.2 15.2 0 1 0 .2 27.2M24.9 12a9.6 9.6 0 1 0 .2 15.8M29 20h7.1"
      stroke="currentColor" strokeWidth="2.9" strokeLinecap="round" />
  </svg>;
}

function StudioArt({ space }: { space: Space }) {
  const isStudio = space === 'estudio';
  return <svg className="studio-art" viewBox="0 0 680 425" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="studio-fill" x1="20" y1="300" x2="600" y2="80" gradientUnits="userSpaceOnUse">
        <stop stopColor={isStudio ? '#203b30' : '#1b3036'} />
        <stop offset=".55" stopColor={isStudio ? '#527052' : '#3d7472'} />
        <stop offset="1" stopColor={isStudio ? '#b9d18d' : '#97caca'} />
      </linearGradient>
      <linearGradient id="studio-light" x1="250" y1="420" x2="490" y2="10" gradientUnits="userSpaceOnUse">
        <stop stopColor={isStudio ? '#caeba2' : '#b4e3e1'} stopOpacity="0" />
        <stop offset=".68" stopColor={isStudio ? '#caeba2' : '#b4e3e1'} stopOpacity=".82" />
        <stop offset="1" stopColor="#f4f4cf" stopOpacity=".95" />
      </linearGradient>
    </defs>
    <rect width="680" height="425" fill="url(#studio-fill)" />
    <path d="M-50 475C92 401 130 466 212 373c65-74 132-44 185-121 41-60 94-69 134-127 46-65 89-65 190-149" stroke="url(#studio-light)" strokeWidth="90" strokeOpacity=".25" />
    {Array.from({ length: 22 }, (_, i) =>
      <path key={i}
        d="M-120 478C90 422 166 470 255 357c82-102 145-24 215-150C519 124 580 127 748-51"
        transform={'translate(' + (i * 8 - 46) + ' ' + (i * 9 - 101) + ')'}
        stroke={isStudio ? '#d0e8a5' : '#bbe5df'} strokeWidth=".7" opacity={Math.max(.09, .54 - i * .018)} />)}
    <circle cx="562" cy="95" r="74" fill="#f3efc5" opacity=".18" />
    <circle cx="562" cy="95" r="40" fill="#e7eec4" opacity=".19" />
  </svg>;
}

function SpacesView({ space }: { space: Space }) {
  const data = spaceData[space];
  return <div className="showcase-home" style={{ '--space-color': data.accent } as CSSProperties}>
    <StudioArt space={space} />
    <div className="showcase-home-shade" />
    <div className="showcase-home-content">
      <div className="showcase-project-tag"><span /> ESPAÇO DE TRABALHO / {data.name.toUpperCase()}</div>
      <h3>{data.heading}</h3>
      <p>{data.description}</p>
      <div className="showcase-bookmarks">
        {data.tabs.map((tab, index) => <span key={tab}><span>{index + 1}</span>{tab}<ArrowUpRight size={13} /></span>)}
      </div>
    </div>
    <div className="showcase-location"><span>ORLA</span><span>CONTEÚDO DE EXEMPLO</span></div>
  </div>;
}

function SplitView() {
  return <div className="showcase-split">
    <div className="split-pane split-pane-left">
      <div className="split-pane-title"><Globe2 size={13} /> projeto / guia de estilo <span>↗</span></div>
      <div className="split-design">
        <span>IDENTIDADE / VISUAL</span>
        <strong>Clareza<br />em cada<br /><em>detalhe.</em></strong>
        <div className="split-swatch-row"><i /><i /><i /><i /></div>
        <div className="split-caption">PALETA — REFERÊNCIA VISUAL</div>
      </div>
    </div>
    <div className="showcase-split-divider"><span /></div>
    <div className="split-pane split-pane-right">
      <div className="split-pane-title"><Globe2 size={13} /> projeto / notas <span>↗</span></div>
      <div className="split-notes">
        <span>NOTAS DE PROJETO</span>
        <h3>Do lado de cá.</h3>
        <p>Enquanto você consulta a referência, pode continuar no que estava fazendo.</p>
        <div className="split-note-line wide" /><div className="split-note-line" /><div className="split-note-line medium" />
        <div className="split-note-footer"><span className="split-note-dot" /> Duas páginas, uma janela.</div>
      </div>
    </div>
  </div>;
}

function CapturesView() {
  return <div className="showcase-captures">
    <div className="capture-heading"><span>Biblioteca de capturas</span><span>REFERÊNCIAS / ESTÚDIO</span></div>
    <h3>As boas ideias<br />não somem.</h3>
    <div className="capture-search"><Search size={16} /><span>Buscar nas capturas...</span></div>
    <div className="capture-grid">
      <div className="capture-tile"><span className="capture-tile-art capture-art-type"><strong>Aa</strong><small>Typography</small></span><span><Bookmark size={13} /> Escala tipográfica</span></div>
      <div className="capture-tile"><span className="capture-tile-art capture-art-color"><i /><i /><i /></span><span><Bookmark size={13} /> Contraste e cor</span></div>
      <div className="capture-tile"><span className="capture-tile-art capture-art-lines">{Array.from({length: 9},(_,i)=><i key={i}/>)}</span><span><Bookmark size={13} /> Notas de interface</span></div>
    </div>
    <p>Capturas e referências salvas neste dispositivo.</p>
  </div>;
}

export function HeroTheatre({ download, revealed = true }: { download: string; revealed?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [scene, setScene] = useState<Scene>('espacos');
  const [space, setSpace] = useState<Space>('estudio');
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const tiltX = useTransform(scrollYProgress, [0, .8], [6, 0]);
  const tiltY = useTransform(scrollYProgress, [0, .8], [-9, 0]);
  const stageY = useTransform(scrollYProgress, [0, 1], [0, -36]);
  const activeScene = scenes.find((item) => item.id === scene)!;
  const ready = revealed || Boolean(reduced);
  const heroEase = [0.16, 1, 0.3, 1] as const;

  return (
    <section ref={sectionRef} id="inicio" className="cinematic-hero" aria-labelledby="hero-title">
      {ready && <HorizonField />}
      <motion.div className="hero-reveal-glow" aria-hidden="true" initial={false}
        animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : .83 }}
        transition={{ duration: 1.15, ease: heroEase }} />
      <div className="hero-vector-world" aria-hidden="true">
        <svg viewBox="0 0 1440 1000" fill="none" preserveAspectRatio="xMidYMid slice">
          <circle cx="1050" cy="472" r="355" stroke="#c4dc9b" strokeWidth=".8" strokeOpacity=".25" />
          <circle cx="1050" cy="472" r="468" stroke="#9bc49e" strokeWidth=".7" strokeOpacity=".16" />
          <circle cx="1050" cy="472" r="575" stroke="#9bc49e" strokeWidth=".7" strokeOpacity=".13" />
          <path d="M-50 756C285 854 364 532 680 644s570 15 828-229" stroke="#d2ecac" strokeOpacity=".24" />
          <path d="M-50 774C285 872 364 550 680 662s570 15 828-229" stroke="#d2ecac" strokeOpacity=".18" />
          <path d="M-50 792C285 890 364 568 680 680s570 15 828-229" stroke="#d2ecac" strokeOpacity=".12" />
          <circle cx="1048" cy="472" r="4" fill="#d8fb82" />
          <path d="M1048 446v52m-26-26h52" stroke="#d8fb82" strokeOpacity=".6" />
        </svg>
      </div>
      <div className="wide-shell hero-composition">
        <div className="hero-statement">
          <motion.h1 id="hero-title" initial={false}
            animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 30, filter: ready ? 'blur(0px)' : 'blur(7px)' }}
            transition={{ duration: reduced ? 0 : .82, delay: ready ? .12 : 0, ease: heroEase }}>
            Você não trabalha<br />em abas.<br /><em>Trabalha em projetos.</em>
          </motion.h1>
          <motion.p initial={false}
            animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 18 }}
            transition={{ duration: reduced ? 0 : .68, delay: ready ? .28 : 0, ease: heroEase }}>
            Abas, sessões e referências organizadas por espaço de trabalho. Abra um projeto e continue de onde parou.
          </motion.p>
          <motion.div className="hero-statement-actions" initial={false}
            animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 12 }}
            transition={{ duration: reduced ? 0 : .55, delay: ready ? .4 : 0, ease: heroEase }}>
            <a className="download-button" href={download} target="_blank" rel="noopener noreferrer">Baixar prévia <Download size={18} /></a>
            <a className="hero-explore" href="#experimente">Ver o Orla em ação <ArrowUpRight size={17} /></a>
          </motion.div>
          <div className="hero-preview-note"><span className="availability-pulse" /> Prévia para Windows x64 <span>·</span> Em desenvolvimento</div>
        </div>
        <div className="cinematic-stage">
          <div className="stage-coordinate stage-coordinate-top" aria-hidden="true">ORLA / WORKSPACE VIEW</div>
          <motion.div className="stage-perspective" style={reduced ? undefined : { rotateX: tiltX, rotateY: tiltY, y: stageY }}
            initial={false}
            animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : .86, x: ready ? 0 : 42, filter: ready ? 'blur(0px)' : 'blur(10px)' }}
            transition={{ duration: reduced ? 0 : 1.08, delay: ready ? .05 : 0, ease: heroEase }}>
            <div className="showcase-device">
              <div className="showcase-topbar">
                <div className="showcase-top-left"><PanelLeft size={16} /><span className="showcase-top-spacer" /><ArrowLeft size={14} /><ArrowRight size={14} /></div>
                <div className="showcase-address"><Search size={13} /><span>{scene === 'capturas' ? 'Capturas' : scene === 'dividir' ? 'Duas páginas' : 'Nova aba'}</span><kbd>Ctrl L</kbd></div>
                <div className="showcase-window-actions"><span>−</span><span>□</span><span>×</span></div>
              </div>
              <div className="showcase-main">
                <div className="showcase-sidebar">
                  <div className="showcase-side-head"><BrandMark /><span>orla<span>.</span></span></div>
                  <div className="showcase-side-group"><span>ESPAÇOS</span>
                    <div className={space === 'estudio' ? 'showcase-space active' : 'showcase-space'}><span>E</span>Estúdio</div>
                    <div className={space === 'pesquisa' ? 'showcase-space active' : 'showcase-space'}><span>P</span>Pesquisa</div>
                  </div>
                  <div className="showcase-side-group"><span>ABAS</span>
                    {(scene === 'capturas' ? ['Capturas', 'Referências', 'Inspirações'] : spaceData[space].tabs).map((name, index) =>
                      <div key={name} className={'showcase-tab-line ' + (index === 0 ? 'selected' : '')}><Globe2 size={12} />{name}</div>)}
                  </div>
                  <div className="showcase-side-bottom"><span /> Salvo neste dispositivo</div>
                </div>
                <div className="showcase-viewport">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={scene + '-' + (scene === 'espacos' ? space : '')} className="scene-transition"
                      initial={reduced ? { opacity: 1 } : { opacity: 0, x: 24, filter: 'blur(7px)' }}
                      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                      exit={reduced ? { opacity: 1 } : { opacity: 0, x: -15, filter: 'blur(5px)' }}
                      transition={{ duration: reduced ? 0 : .38, ease: [.2, .8, .2, 1] }}>
                      {scene === 'espacos' && <SpacesView space={space} />}
                      {scene === 'dividir' && <SplitView />}
                      {scene === 'capturas' && <CapturesView />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <div className="stage-reflection" aria-hidden="true" />
          </motion.div>
          <div className="stage-coordinate stage-coordinate-bottom" aria-hidden="true">VISUALIZAÇÃO INTERATIVA / DADOS DE EXEMPLO</div>
        </div>
      </div>
      <div className="wide-shell hero-interaction-row">
        <div className="hero-scene-switcher" role="group" aria-label="Visualizar recursos do Orla">
          {scenes.map(({ id, label, icon: Icon }) =>
            <button type="button" key={id} onClick={() => setScene(id)} aria-pressed={scene === id}
              className={'hero-scene-button ' + (scene === id ? 'is-selected' : '')}>
              <Icon size={17} strokeWidth={1.6} />{label}<span />
            </button>)}
        </div>
        <div className="hero-scene-description" aria-live="polite">
          <strong>{activeScene.title}</strong><span>{activeScene.description}</span>
          {scene === 'espacos' && <button type="button" className="hero-space-toggle" onClick={() => setSpace(space === 'estudio' ? 'pesquisa' : 'estudio')}>
            Abrir {space === 'estudio' ? 'Pesquisa' : 'Estúdio'} <ArrowUpRight size={15} />
          </button>}
        </div>
        <a className="hero-scroll-cue" href="#experimente" aria-label="Ir à demonstração"><ArrowDown size={21} /></a>
      </div>
      <p className="hero-illustrative-note wide-shell">As telas desta apresentação são ilustrativas e demonstram recursos presentes na prévia do Orla.</p>
    </section>
  );
}
