import { ArrowUpRight, Bookmark, Braces, Columns2, FolderOpen, History, LayoutGrid, Search } from 'lucide-react';
import { Enter } from './motion-scenes';

const stories = [
  {
    id: 'espacos',
    eyebrow: '01 / ESPAÇOS',
    title: 'Um projeto. Um espaço. Suas abas no lugar.',
    description: 'Separe o que está pesquisando, criando ou revisando. Cada espaço mantém suas próprias abas para você voltar sem reconstruir tudo.',
    icon: LayoutGrid,
  },
  {
    id: 'dividir',
    eyebrow: '02 / TELA DIVIDIDA',
    title: 'Duas páginas. Nenhum malabarismo de janelas.',
    description: 'Leia uma referência enquanto trabalha na outra página. Ajuste a largura dos dois lados arrastando a divisão.',
    icon: Columns2,
  },
  {
    id: 'capturas',
    eyebrow: '03 / CAPTURAS',
    title: 'O link que vale guardar não precisa se perder.',
    description: 'Salve trechos e referências do que encontrou pelo caminho. Depois, procure nas capturas sem ter de lembrar em qual aba estava.',
    icon: Bookmark,
  },
] as const;

const details = [
  { index: '04', title: 'Sessões que você pode retomar', description: 'Reabra as abas de uma sessão ou exporte uma cópia em JSON.', icon: History },
  { index: '05', title: 'Busca entre abas abertas', description: 'Encontre páginas e espaços pela própria barra de endereços.', icon: Search },
  { index: '06', title: 'DevTools onde você precisa', description: 'Abra as ferramentas com F12 e encaixe o painel na janela.', icon: Braces },
] as const;

type StoryId = (typeof stories)[number]['id'];

export function FeatureGlyphs() {
  return <div className="feature-glyphs" aria-hidden="true">
    {stories.map(({ id, icon: Icon }) => <span key={id} className="feature-glyph" data-feature={id}><Icon size={29} strokeWidth={1.55} /></span>)}
  </div>;
}

function FeaturePreview({ id }: { id: StoryId }) {
  return (
    <div className="catalog-preview" data-visual data-feature={id} aria-hidden="true">
      <div className="mini-window">
        <div className="mini-chrome"><i /><i /><i /><span>Orla</span></div>
        {id === 'espacos' && <div className="mini-workspaces">
          <div><strong><LayoutGrid /> Estúdio</strong><span>Portfólio</span><span>Guia de estilo</span><span>Revisão</span></div>
          <div><strong><FolderOpen /> Pesquisa</strong><span>Referências</span><span>Notas de campo</span><span>Inspirações</span></div>
        </div>}
        {id === 'dividir' && <div className="mini-split">
          <div><b>Guia de estilo</b><i /><i /><i /><i /><i /></div>
          <div><b>Notas</b><i /><i /><i /><i /><i /></div>
        </div>}
        {id === 'capturas' && <div className="mini-captures">
          <span><Search /> Buscar nas capturas</span>
          <strong><Bookmark /> Contraste e cor</strong>
          <strong><Bookmark /> Escala tipográfica</strong>
          <strong><Bookmark /> Referências do portfólio</strong>
        </div>}
      </div>
      <div className="visual-corner"><span>ORLA / {id.toUpperCase()}</span><span>↗</span></div>
    </div>
  );
}

export function FeatureCatalog() {
  return (
    <div className="feature-editorial-list">
      {stories.map(({ id, eyebrow, title, description }) => (
        <article className="feature-story" data-feature={id} key={id}>
          <Enter className="feature-story-copy">
            <span className="feature-story-eyebrow">{eyebrow}</span>
            <h3>{title}</h3>
            <p>{description}</p>
            <a href={'#mode-' + id} className="story-link">Experimentar o recurso <ArrowUpRight size={17} /></a>
          </Enter>
          <Enter className="feature-story-visual" delay={0.1}>
            <FeaturePreview id={id} />
          </Enter>
        </article>
      ))}
      <div className="minor-features">
        {details.map(({ index, title, description, icon: Icon }) => (
          <article className="minor-feature" key={index}>
            <span>{index} / 06</span>
            <Icon size={22} strokeWidth={1.35} aria-hidden="true" />
            <div><h3>{title}</h3><p>{description}</p></div>
          </article>
        ))}
      </div>
    </div>
  );
}
