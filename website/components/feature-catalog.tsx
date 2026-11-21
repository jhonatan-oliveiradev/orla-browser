import { ArrowUpRight, Bookmark, Braces, Columns2, FolderOpen, History, LayoutGrid, Search } from 'lucide-react';

const features = [
  { id: 'espacos', title: 'Espaços de trabalho', description: 'Separe as abas por projeto e volte com as páginas no lugar.', icon: LayoutGrid, mode: true },
  { id: 'dividir', title: 'Tela dividida', description: 'Compare duas páginas na mesma janela e ajuste a largura de cada uma.', icon: Columns2, mode: true },
  { id: 'capturas', title: 'Capturas', description: 'Guarde trechos e referências e encontre o que precisa pela busca.', icon: Bookmark, mode: true },
  { id: 'sessoes', title: 'Sessões salvas', description: 'Reabra as abas de uma sessão ou exporte uma cópia em JSON.', icon: History },
  { id: 'busca', title: 'Busca de abas', description: 'Use a barra de endereços para encontrar páginas e espaços já abertos.', icon: Search },
  { id: 'devtools', title: 'Ferramentas de desenvolvimento', description: 'Abra o DevTools com F12 e encaixe o painel dentro da janela.', icon: Braces },
] as const;

type Feature = (typeof features)[number];

export function FeatureGlyphs() {
  return (
    <div className="feature-glyphs" aria-hidden="true">
      {features.map(({ id, icon: Icon }) => <span key={id} className="feature-glyph" data-feature={id}><Icon size={29} strokeWidth={1.55} /></span>)}
    </div>
  );
}

function FeaturePreview({ id }: { id: Feature['id'] }) {
  return (
    <div className="catalog-preview" data-visual data-feature={id} aria-hidden="true">
      <div className="mini-window">
        <div className="mini-chrome"><i /><i /><i /><span>Orla</span></div>
        {id === 'espacos' && <div className="mini-workspaces"><div><strong><LayoutGrid /> Estúdio</strong><span>Portfólio</span><span>Guia de estilo</span></div><div><strong><FolderOpen /> Pesquisa</strong><span>Referências</span><span>Notas de campo</span></div></div>}
        {id === 'dividir' && <div className="mini-split"><div><b>Guia de estilo</b><i /><i /><i /></div><div><b>Notas</b><i /><i /><i /></div></div>}
        {id === 'capturas' && <div className="mini-captures"><span><Search /> Buscar nas capturas</span><strong><Bookmark /> Contraste e cor</strong><strong><Bookmark /> Escala tipográfica</strong></div>}
        {id === 'sessoes' && <div className="mini-sessions"><strong><History /> Sessões salvas</strong><span>Estúdio <small>3 abas</small></span><span>Pesquisa <small>2 abas</small></span></div>}
        {id === 'busca' && <div className="mini-captures"><span><Search /> Portfólio <kbd>Ctrl L</kbd></span><strong><ArrowUpRight /> Portfólio / Estúdio</strong><strong><FolderOpen /> Portfólio / Pesquisa</strong></div>}
        {id === 'devtools' && <div className="mini-devtools"><strong>Elementos <span>Console</span> <span>Rede</span></strong><code>&lt;main class=&quot;workspace&quot;&gt;<br />&nbsp; &lt;nav&gt;…&lt;/nav&gt;<br />&lt;/main&gt;</code></div>}
      </div>
    </div>
  );
}

export function FeatureCatalog() {
  return (
    <div className="catalog">
      {features.map((item) => {
        const { id, title, description, icon: Icon } = item;
        return <article className="catalog-item" data-feature={id} key={id}>
          <FeaturePreview id={id} />
          <div className="catalog-body">
            <div className="catalog-icon" aria-hidden="true"><Icon size={19} /></div>
            <h3>{title}</h3>
            <p>{description}</p>
            {'mode' in item && <a href={`#mode-${id}`} className="catalog-link" aria-label={`Testar ${title.toLocaleLowerCase('pt-BR')} na demonstração`}>Testar na demonstração <ArrowUpRight size={14} /></a>}
          </div>
        </article>;
      })}
    </div>
  );
}
