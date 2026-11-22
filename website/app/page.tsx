import { ArrowRight, ArrowUpRight, Download, Plus } from 'lucide-react';
import { FeatureCatalog } from '../components/feature-catalog';
import { Enter, ScrollTrack } from '../components/motion-scenes';
import { HeroTheatre } from '../components/hero-theatre';
import { CoastEmblem } from '../components/coast-emblem';
import { WorkspaceDemo } from '../components/workspace-demo';

const repository = 'https://github.com/jhonatan-oliveiradev/orla-browser';
const download = process.env.ORLA_DOWNLOAD_URL ?? (repository + '/actions/runs/44924488746/artifacts/14714723280');

function Mark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={'brand-mark ' + className}>
      <path d="M26.9 6.35a15.2 15.2 0 1 0 .2 27.2M24.9 12a9.6 9.6 0 1 0 .2 15.8M29 20h7.1" stroke="currentColor" strokeWidth="2.9" strokeLinecap="round" />
    </svg>
  );
}

function Brand() {
  return <a href="#inicio" className="new-brand" aria-label="Orla Browser — início"><Mark /><span>orla<span className="brand-period">.</span></span></a>;
}

function DownloadLink({ className = '' }: { className?: string }) {
  return <a className={'download-button ' + className} href={download} target="_blank" rel="noopener noreferrer">
    <span>Baixar prévia</span><Download size={17} strokeWidth={1.8} />
  </a>;
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <ScrollTrack />
      <header className="new-header">
        <div className="wide-shell header-inner">
          <Brand />
          <nav className="new-nav" aria-label="Navegação principal">
            <a href="#experimente">Experimente</a>
            <a href="#recursos">Recursos</a>
            <a href="#sobre">Por que Orla?</a>
          </nav>
          <a className="header-download" href="#baixar"><span>Prévia para Windows</span><ArrowUpRight size={17} /></a>
        </div>
      </header>

      <main id="conteudo">
        <HeroTheatre download={download} />


        <section className="showcase-section" id="experimente" aria-labelledby="showcase-title">
          <div className="wide-shell">
            <div className="showcase-intro">
              <span className="section-index">01 — A EXPERIÊNCIA</span>
              <Enter className="showcase-heading">
                <h2 id="showcase-title">Fechou o projeto?<br /><span>Ele continua onde você deixou.</span></h2>
                <p>Um espaço para o trabalho, outro para a pesquisa, outro para o que vier. Veja o Orla em funcionamento nesta demonstração interativa.</p>
              </Enter>
            </div>
            <Enter className="showcase-window" delay={0.08}>
              <div className="showcase-window-top"><span><i /> VISUALIZAÇÃO INTERATIVA</span><span>DADOS DE EXEMPLO — NÃO É UMA GRAVAÇÃO</span></div>
              <WorkspaceDemo />
            </Enter>
            <div className="showcase-bottom">
              <span>01 / 03</span>
              <span>MUDE DE ESPAÇO. DIVIDA A TELA. ENCONTRE UMA CAPTURA.</span>
            </div>
          </div>
        </section>

        <section className="interlude-section" id="sobre" aria-labelledby="interlude-title">
          <div className="wide-shell interlude-inner">
            <div className="interlude-kicker"><span className="section-index">02 — A IDEIA</span><span className="interlude-rule" /></div>
            <Enter>
              <h2 id="interlude-title">O problema nunca foi ter <em>muitas abas.</em><br />Foi perder o caminho entre elas.</h2>
            </Enter>
            <div className="interlude-bottom">
              <CoastEmblem />
              <p>Uma pesquisa vira referência. A referência abre outra página. Quando você volta ao projeto, precisa lembrar onde tudo ficou. O Orla foi pensado para preservar esse contexto.</p>
            </div>
          </div>
        </section>

        <section className="features-editorial" id="recursos" aria-labelledby="features-title">
          <div className="wide-shell">
            <div className="feature-topline"><span className="section-index">03 — AS FERRAMENTAS</span><span>CRIADAS PARA O DIA A DIA</span></div>
            <Enter className="feature-intro">
              <h2 id="features-title">Poucos gestos.<br /><em>Mais controle.</em></h2>
              <p>Troque de projeto, compare páginas e retome uma referência sem desmontar seu espaço de trabalho.</p>
            </Enter>
            <FeatureCatalog />
          </div>
        </section>

        <section className="local-section" aria-labelledby="local-title">
          <div className="wide-shell local-inner">
            <div className="local-aside">
              <span className="section-index">04 — NO SEU DISPOSITIVO</span>
              <span className="local-symbol"><Mark /></span>
            </div>
            <Enter className="local-copy">
              <p className="micro-label">SEU CONTEXTO, COM VOCÊ.</p>
              <h2 id="local-title">As suas sessões não precisam morar na nuvem.</h2>
              <p>Espaços, sessões e capturas ficam salvos no dispositivo. E, se precisar levar uma sessão para outra instalação, você pode exportá-la em JSON.</p>
              <a href={repository} target="_blank" rel="noopener noreferrer" className="text-arrow-link">Conhecer o projeto <ArrowUpRight size={18} /></a>
            </Enter>
          </div>
        </section>

        <section className="final-cta" id="baixar" aria-labelledby="cta-title">
          <div className="wide-shell">
            <div className="cta-kicker"><span className="section-index">05 — COMECE POR AQUI</span><span>ORLA / WINDOWS x64</span></div>
            <Enter className="cta-content">
              <h2 id="cta-title">A próxima aba<br />já tem <em>lugar.</em></h2>
              <div className="cta-right">
                <p>Conheça a prévia para Windows. O Orla está em desenvolvimento — experimente, encontre os limites e acompanhe as próximas versões.</p>
                <DownloadLink className="download-button-large" />
                <span className="cta-note">Prévia para Windows x64. O download atual é disponibilizado pelo GitHub e pode exigir login.</span>
                <a href={repository + '/actions'} target="_blank" rel="noopener noreferrer" className="text-arrow-link">Ver compilações <ArrowUpRight size={16} /></a>
              </div>
            </Enter>
          </div>
        </section>

        <section className="questions-section" id="perguntas" aria-labelledby="questions-title">
          <div className="wide-shell questions-grid">
            <div><span className="section-index">06 — PERGUNTAS DIRETAS</span><h2 id="questions-title">Antes de instalar.</h2></div>
            <div className="questions-list">
              <details><summary>Quais sistemas são compatíveis?<Plus size={19} /></summary><p>Esta prévia foi preparada para Windows x64. Ela utiliza o WebView2 Runtime, que o instalador pode baixar se não estiver disponível.</p></details>
              <details><summary>Minhas sessões são sincronizadas?<Plus size={19} /></summary><p>Não existe sincronização em nuvem nesta prévia. Sessões e capturas ficam no seu dispositivo. Você pode exportar sessões em JSON.</p></details>
              <details><summary>Posso usar extensões?<Plus size={19} /></summary><p>Você pode carregar uma extensão descompactada pelo painel de extensões. A compatibilidade varia conforme os recursos suportados pelo WebView2.</p></details>
              <details><summary>O Orla já está pronto?<Plus size={19} /></summary><p>Ainda não. É uma prévia em desenvolvimento, disponível para testar. Algumas funcionalidades e a experiência de instalação podem mudar.</p></details>
            </div>
          </div>
        </section>
      </main>

      <footer className="new-footer">
        <div className="wide-shell">
          <div className="footer-head"><Brand /><span>Um lugar para cada projeto.</span></div>
          <div className="footer-links">
            <span>© {new Date().getFullYear()} ORLA BROWSER</span>
            <nav aria-label="Navegação do rodapé"><a href="#experimente">Demonstração</a><a href="#recursos">Recursos</a><a href="#perguntas">Perguntas</a><a href={repository} target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={13} /></a></nav>
            <a className="footer-top" href="#inicio">Voltar ao início <ArrowRight size={14} /></a>
          </div>
        </div>
      </footer>
    </>
  );
}
