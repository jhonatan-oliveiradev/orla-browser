import { ArrowDown, ArrowUpRight, Download, Plus } from 'lucide-react';
import { FeatureCatalog } from '../components/feature-catalog';
import { HeroChart } from '../components/hero-chart';
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
        <section className="hero" aria-labelledby="hero-title" data-enter>
          <HeroChart />
          <div className="shell hero-content">
            <span className="hero-wordmark" aria-hidden="true">ORLA<span>.</span></span>
            <h1 id="hero-title">Um navegador para<br /> quem trabalha por projeto.</h1>
            <p>Reúna abas, notas e referências em espaços que você pode retomar quando precisar.</p>
            <div className="hero-actions">
              <a className="primary-button inline-flex items-center gap-2" href="#baixar"><Download size={17} /> Baixar para Windows</a>
              <a className="demo-link inline-flex items-center gap-2" href="#demo">Testar o Orla <ArrowDown size={15} /></a>
            </div>
            <p className="hero-label"><span /> Prévia para Windows x64</p>
          </div>
        </section>
        <section className="product" id="demo" aria-labelledby="demo-title">
          <div className="shell">
            <div className="section-heading">
              <h2 id="demo-title">Um lugar para<br /> cada <em>projeto.</em></h2>
              <p>Experimente com as abas de um estúdio. Troque de espaço, abra duas páginas lado a lado ou encontre uma referência salva.</p>
            </div>
            <WorkspaceDemo />
          </div>
        </section>
        <section id="recursos" className="features" aria-labelledby="features-title">
          <div className="shell">
            <div className="section-heading">
              <h2 id="features-title">O que vem<br /> no <em>Orla.</em></h2>
              <p>Da primeira aba à próxima sessão, explore as ferramentas que cabem na mesma janela.</p>
            </div>
            <FeatureCatalog />
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
      <footer className="site-footer">
        <div className="shell footer-inner">
          <div><Brand /><p>Navegador para Windows.</p></div>
          <nav aria-label="Produto"><h2>Produto</h2><a href="#demo">Demonstração</a><a href="#recursos">Recursos</a><a href="#baixar">Baixar</a></nav>
          <nav aria-label="Documentação"><h2>Documentação</h2><a href="#perguntas">Perguntas frequentes</a><a href={repository} className="inline-flex items-center gap-1">GitHub <ArrowUpRight size={14} /></a></nav>
        </div>
      </footer>
    </>
  );
}
