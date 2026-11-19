# Orla Browser

Orla é um navegador desktop para Windows com uma barra compacta e abas recolhíveis.

## Rodar no Windows

Instale Node.js, Rust com a toolchain MSVC, os componentes C++ do Visual Studio Build Tools e o WebView2 Runtime. Na raiz do repositório:

```powershell
npm ci
npm run dev
```

`npm run build` compila o executável sem empacotar um instalador. `npm run check` valida os scripts e as regras de interpretação da barra de endereço.

## Instalador do Windows

Em um ambiente de desenvolvimento Windows x64, execute `npm ci` e `npm run build:installer`. O Tauri gera o instalador NSIS em `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.

O instalador configura o Orla para o usuário atual e usa a internet para obter o WebView2 caso o runtime esteja ausente. Os builds de teste são gerados sem assinatura de código.

No GitHub Actions, o workflow **Windows validation** executa os testes JavaScript e verifica o código Rust nos PRs. Quando for hora de empacotar uma entrega, uma execução manual do workflow gera o instalador, verifica se ele instala e abre o Orla e disponibiliza o artefato **orla-browser-windows-x64**.

## Primeiro recorte

- Nova aba com favoritos de início e interface baseada no [Figma V3](https://www.figma.com/design/z0VTjnV3KAlis2UDNxif9b?node-id=15-29).
- A nova aba oferece **Início**, **Widgets** (hora local e nota salva neste dispositivo) e **Retomar** (páginas abertas e páginas fechadas na sessão atual).
- O botão **Tema** troca a aparência entre Lima, Lavanda e Areia. O grafismo da Nova Aba pode ficar estático por preferência do sistema ou pelo controle de animação nesse menu. A escolha é salva no dispositivo.
- Arraste o espaço livre da barra superior para mover a janela. Use as bordas e os cantos para redimensionar.
- As abas ficam na lateral. Arraste o divisor ou use as setas do teclado para mudar a largura. O botão na barra de ferramentas recolhe a lateral para mostrar apenas a aba atual. A largura, o estado recolhido e as abas fixadas são restaurados quando você reabre o Orla.
- Navegação HTTP(S) em webviews nativas e controles de histórico por aba. O Orla salva localmente os endereços e a aba selecionada. Ao reiniciar, carrega a aba selecionada e deixa as demais aguardando seleção. O histórico de voltar e avançar recomeça com cada nova execução.
- O painel de abas permite buscar entre as abertas e reabrir a última aba fechada na execução atual. A estrela na barra adiciona ou remove páginas dos favoritos da nova aba.
- No Windows, use Ctrl+L para focar a barra de endereço, Ctrl+T para abrir aba, Ctrl+W para fechar e Ctrl+Shift+T para reabrir, inclusive com foco dentro de um site. Use as setas e Enter para escolher sugestões locais.
- A barra sugere abas abertas, favoritos e visitas locais. O painel **Retomar** inclui as últimas 500 visitas, com filtro e opções de apagar uma visita ou limpar tudo.
- Digite uma pesquisa na barra ou na Nova Aba para abrir a **Busca do Orla**. Em **Configurar provedor**, informe o endereço de uma instância SearXNG com JSON ativado em `search.formats`. O Orla envia apenas a consulta confirmada e oferece o DuckDuckGo como ação separada. Um provedor HTTPS remoto ou uma instância HTTP no próprio computador são aceitos. O Orla não inclui uma instância SearXNG hospedada.
- O painel Agente é apenas informativo. A interface local tem permissões próprias e os webviews de sites não recebem acesso aos comandos do aplicativo.
- Links HTTP(S) que pedem uma nova janela em resposta a uma ação do usuário abrem uma aba. Pop-ups automáticos continuam bloqueados. A lista de downloads da sessão permite acompanhar, cancelar e localizar arquivos concluídos.
- Quando a navegação falhar, a aba mostra **Tentar novamente** e o jogo offline **Sinal de Volta**. Use Espaço, seta para cima ou toque para saltar e coletar sinais. O recorde fica no dispositivo.
- Em **Tema → Provedor de busca** você pode testar uma instância SearXNG antes de salvá-la. O teste envia a consulta padrão `Orla`.
