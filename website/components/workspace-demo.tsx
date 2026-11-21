'use client';

import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, Circle, Columns2, Files, Globe, GripVertical, LayoutGrid, PanelLeft, Plus, Search } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

const modes = [
  { id: 'espacos', title: 'Espaços de trabalho', short: 'Espaços', icon: LayoutGrid, detail: 'Separe as abas de cada projeto e volte com tudo no lugar.' },
  { id: 'dividir', title: 'Tela dividida', short: 'Dividir', icon: Columns2, detail: 'Compare duas páginas na mesma janela. Arraste o divisor para ajustar a largura.' },
  { id: 'capturas', title: 'Capturas', short: 'Capturas', icon: Bookmark, detail: 'Busque nos trechos e links que você guardou no espaço.' },
] as const;
type Mode = typeof modes[number]['id'];

const workspaces = [
  { name: 'Estúdio', initial: 'E', domain: 'estudio.orla', tabs: ['Nova aba', 'Portfólio', 'Guia de estilo'], paths: ['', 'portfolio', 'guia-de-estilo'], description: 'Identidade, portfólio e referências do estúdio.' },
  { name: 'Pesquisa', initial: 'P', domain: 'pesquisa.orla', tabs: ['Nova aba', 'Referências', 'Notas de campo'], paths: ['', 'referencias', 'notas-de-campo'], description: 'Referências, leituras e notas da pesquisa.' },
] as const;

const captures = [
  ['Uma escala tipográfica flexível', 'Uma referência de tipografia para o próximo layout.', 'Guia de estilo'],
  ['Contraste em superfícies escuras', 'Notas sobre contraste de texto e controles.', 'Referências'],
  ['Revisão do portfólio', 'Separar os projetos por tipo e guardar os rascunhos.', 'Portfólio'],
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}

export function WorkspaceDemo() {
  const [mode, setMode] = useState<Mode>('espacos');
  const [space, setSpace] = useState(0);
  const [tab, setTab] = useState(0);
  const [split, setSplit] = useState(53);
  const [query, setQuery] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduce = useReducedMotion();
  const activeSpace = workspaces[space];
  const selectedMode = modes.find((item) => item.id === mode)!;
  const shownCaptures = captures.filter((capture) => normalize(capture.join(' ')).includes(normalize(query.trim())));

  function changeWorkspace(index: number) {
    setSpace(index);
    setTab(0);
  }

  function changeSplit(value: number) {
    setSplit(Math.round(Math.min(71, Math.max(29, value))));
  }

  function dragDivider(event: PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !stage.current) return;
    const bounds = stage.current.getBoundingClientRect();
    changeSplit((event.clientX - bounds.left) / bounds.width * 100);
  }

  function focusMode(event: KeyboardEvent, index: number) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? modes.length - 1 :
      event.key === 'ArrowRight' ? (index + 1) % modes.length :
      event.key === 'ArrowLeft' ? (index + modes.length - 1) % modes.length : null;
    if (next === null) return;
    event.preventDefault();
    setMode(modes[next].id);
    tabRefs.current[next]?.focus();
  }

  const address = mode === 'capturas' ? 'orla://capturas' : mode === 'dividir' ? activeSpace.domain : tab ? `${activeSpace.domain}/${activeSpace.paths[tab]}` : 'Nova aba';

  return (
    <div className="demo">
      <div className="demo-modes" role="tablist" aria-label="Recursos da demonstração">
        {modes.map(({ id, title, short, icon: Icon }, index) => (
          <button key={id} type="button" id={`mode-${id}`} role="tab" aria-selected={mode === id} aria-controls="demo-panel" tabIndex={mode === id ? 0 : -1}
            ref={(element) => { tabRefs.current[index] = element; }} onClick={() => setMode(id)} onKeyDown={(event) => focusMode(event, index)} aria-label={title}>
            <Icon size={17} /><span className="mode-full">{title}</span><span className="mode-short">{short}</span>
          </button>
        ))}
      </div>
      <div className="browser" id="demo-panel" role="tabpanel" aria-labelledby={`mode-${mode}`}>
        <div className="browser-bar" aria-hidden="true">
          <PanelLeft size={15} /><ArrowLeft className="chrome-extra" size={14} /><ArrowRight className="chrome-extra" size={14} />
          <div className="address"><Search size={13} /><span>{address}</span><kbd>Ctrl L</kbd></div>
          <Plus size={15} /><span className="window-controls">− <Circle size={8} /> ×</span>
        </div>
        <div className="browser-body">
          <aside className="demo-sidebar" aria-label="Espaços de exemplo">
            <div className="sidebar-spaces">
              {workspaces.map(({ name, initial }, index) => (
                <button key={name} type="button" aria-label={name} aria-pressed={space === index} onClick={() => changeWorkspace(index)}>
                  <span>{initial}</span><strong>{name}</strong>
                </button>
              ))}
            </div>
            {mode === 'espacos' && <div className="sidebar-tabs">
              <span>Abas</span>
              {activeSpace.tabs.map((label, index) => (
                <button key={label} type="button" aria-pressed={tab === index} onClick={() => setTab(index)}>
                  <Globe size={13} /><span>{label}</span>
                </button>
              ))}
            </div>}
            <span className="sidebar-foot"><span /> Salvo neste dispositivo</span>
          </aside>
          <motion.div key={mode} className="demo-stage" ref={stage} initial={reduce ? false : { opacity: .55, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .24 }}>
            {mode === 'espacos' && <div className="demo-home">
              <div className="demo-home-content">
                <p>{activeSpace.name}</p>
                <h3>{tab ? activeSpace.tabs[tab] : 'Nova aba'}</h3>
                <span>{activeSpace.description}</span>
                <div className="demo-favorites">
                  {activeSpace.tabs.slice(1).map((label, index) => <button key={label} type="button" aria-pressed={tab === index + 1} onClick={() => setTab(index + 1)}><ArrowUpRight size={13} />{label}</button>)}
                </div>
              </div>
            </div>}
            {mode === 'dividir' && <div className="split" style={{ gridTemplateColumns: `minmax(0, ${split}fr) 16px minmax(0, ${100 - split}fr)` }}>
              <article><BookOpen size={16} /><h3>{activeSpace.tabs[1]}</h3><p>Reúna os links do projeto e consulte suas referências enquanto escreve.</p></article>
              <button type="button" className="divider" role="separator" aria-label="Ajustar a largura dos painéis" aria-orientation="vertical" aria-valuemin={29} aria-valuemax={71} aria-valuenow={split}
                onPointerDown={(event) => { if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId); }}
                onPointerMove={dragDivider} onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  changeSplit(split + (event.key === 'ArrowLeft' ? -3 : 3));
                }}><GripVertical size={14} /></button>
              <article><Files size={16} /><h3>{activeSpace.tabs[2]}</h3><p>Guarde as decisões e a próxima coisa que você quer testar.</p></article>
            </div>}
            {mode === 'capturas' && <div className="capture">
              <h3>Capturas</h3>
              <label><Search size={16} /><span className="sr-only">Buscar nas capturas</span><input type="search" placeholder="Buscar nas capturas" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <ul>
                {shownCaptures.map(([title, description, source]) => <li key={title}><Bookmark size={14} /><div><strong>{title}</strong><p>{description}</p></div><small>{source}</small></li>)}
              </ul>
              {shownCaptures.length === 0 && <p role="status">Nenhuma captura encontrada. Tente outro termo.</p>}
            </div>}
          </motion.div>
        </div>
      </div>
      <p className="demo-caption">{selectedMode.detail}</p>
    </div>
  );
}
