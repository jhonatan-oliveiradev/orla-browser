import { ArrowDown, ArrowUpRight, Braces, Command, Download, Layers3, Plus } from 'lucide-react';
import { WorkspaceDemo } from '../components/workspace-demo';

const repository = 'https://github.com/jhonatan-oliveiradev/orla-browser';
const download = process.env.ORLA_DOWNLOAD_URL ?? `${repository}/actions/runs/44924488746/artifacts/14714723280`;

function Mark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="brand-mark">
    <path d="M26.9 6.35a15.2 15.2 0 1 0 .2 27.2M24.9 12a9.6 9.6 0 1 0 .2 15.8M29 20h7.1" stroke="currentColor" strokeWidth="2.9" strokeLinecap="round" />
  </svg>;
}

function Brand() {
  return <a href="#" className="brand inline-flex items-center gap-1.5" aria-label="Orla Browser, início"><Mark /><span>orla<span className="brand-period">.</span></span></a>;
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="shell flex items-center justify-between">
          <Brand />
          <nav aria-label="Navegação principal" className="nav-links flex items-center">
            <a href="#demo">Demonstração</a><a href="#recursos">Recursos</a>
          </nav>
          <a href="#baixar" className="header-cta inline-flex items-center gap-2">Baixar <Download size={15} /></a>
        </div>
      </header>
      <main id="conteudo">
        <section className="hero shell" aria-labelledby="hero-title">
          <div>
            <p className="hero-label"><span /> Prévia para Windows</p>
            <h1 id="hero-title">Abra espaço<br /> para suas <em>ideias.</em></h1>
          </div>
          <div className="hero-aside">
            <p>O navegador para quem trabalha com muitas abas. Dê a cada projeto um espaço com suas páginas, notas e referências.</p>
            <div className="hero-actions">
              <a className="primary-button inline-flex items-center gap-2" href="#baixar"><Download size={17} /> Baixar para Windows</a>
              <a className="demo-link inline-flex items-center gap-2" href="#demo">Testar a demonstração <ArrowDown size={15} /></a>
            </div>
          </div>
        </section>
        <section className="product shell" id="demo" aria-label="Demonstração interativa do Orla">
          <WorkspaceDemo />
        </section>
        <section id="recursos" className="features" aria-labelledby="features-title">
          <div className="shell">
            <div className="features-heading">
              <h2 id="features-title">Tudo no lugar<br /> quando você voltar.</h2>
            </div>
            <div className="feature-list">
              <article><Layers3 /><h3>Retome de onde parou</h3><p>Salve as abas e notas de um espaço. Reabra a sessão quando voltar ao projeto ou exporte uma cópia em JSON.</p></article>
              <article><Command /><h3>Encontre uma aba pelo teclado</h3><p>Digite o nome de uma página ou de um espaço na barra de endereços. O Orla encontra o que já está aberto.</p></article>
              <article><Braces /><h3>Inspecione sem sair da janela</h3><p>Use F12 para abrir as ferramentas de desenvolvimento e escolha onde encaixar o painel.</p></article>
            </div>
          </div>
        </section>
        <section className="install" id="baixar" aria-labelledby="install-title">
          <div className="shell install-inner">
            <Mark />
            <div>
              <p className="kicker">Prévia para Windows x64</p>
              <h2 id="install-title">Abra seu<br />primeiro espaço.</h2>
            </div>
            <div className="install-action">
              <a className="primary-button inline-flex items-center gap-2.5" href={download}><Download size={18} /> Baixar para Windows</a>
              <p>Entre no GitHub para baixar o ZIP. Extraia os arquivos e execute o instalador.</p>
              <a className="inline-flex items-center gap-1.5" href={`${repository}/actions`}>Ver compilações <ArrowUpRight size={15} /></a>
            </div>
          </div>
        </section>
        <section className="shell faq" id="perguntas" aria-labelledby="faq-title">
          <h2 id="faq-title">Antes de instalar</h2>
          <div>
            <details><summary>Em quais sistemas o Orla funciona?<Plus size={19} /></summary><p>A prévia é para Windows x64. Se o WebView2 Runtime estiver ausente, o instalador pode baixá-lo durante a instalação.</p></details>
            <details><summary>Onde ficam as sessões e as capturas?<Plus size={19} /></summary><p>Elas ficam no dispositivo. Você pode exportar uma sessão do Orla em JSON e reabri-la em outra instalação.</p></details>
            <details><summary>Posso instalar extensões?<Plus size={19} /></summary><p>Sim. No painel de extensões, escolha a pasta de uma extensão descompactada. A compatibilidade depende dos recursos disponíveis no WebView2.</p></details>
          </div>
        </section>
      </main>
      <footer className="site-footer shell flex flex-wrap items-center justify-between gap-5">
        <Brand />
        <div className="flex items-center gap-5"><a href="#perguntas">Perguntas</a><a href={repository} className="inline-flex items-center gap-1">GitHub <ArrowUpRight size={15} /></a></div>
      </footer>
    </>
  );
}
