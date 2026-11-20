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

No GitHub Actions, o workflow **Windows validation** executa os testes JavaScript e verifica o código Rust nos PRs. Quando for hora de empacotar uma entrega, uma execução manual do workflow ou o rótulo `windows-preview` em um PR interno gera o instalador, instala o Orla e testa busca na página, DevTools, uma extensão local e a restauração de abas e downloads no WebView2 e disponibiliza o artefato **orla-browser-windows-x64**.

## Primeiro recorte

- Nova aba com favoritos de início e interface baseada no [Figma V3](https://www.figma.com/design/z0VTjnV3KAlis2UDNxif9b?node-id=15-29).
- A nova aba oferece **Início**, **Widgets** (hora local e nota salva neste dispositivo) e **Retomar** (páginas abertas e páginas fechadas na sessão atual).
- O botão **Aparência** troca a aparência entre Lima, Lavanda, Areia, Oceano e Grafite. Escolha uma cor de destaque, densidade compacta e painéis translúcidos ou opacos. O grafismo da Nova Aba pode ficar estático por preferência do sistema ou pelo controle de animação nesse menu. A escolha é salva no dispositivo.
- Arraste o espaço livre da barra superior para mover a janela. Use as bordas e os cantos para redimensionar.
- As ações de fixar abas, favoritar páginas, recolher a lateral, maximizar a janela e controlar o jogo usam ícones animados com Morphicons. Com movimento reduzido, o estado muda imediatamente.
- As abas ficam na lateral. Arraste o divisor ou use as setas do teclado para mudar a largura. O botão na barra de ferramentas recolhe a lateral para mostrar apenas a aba atual. A largura, o estado recolhido e as abas fixadas são restaurados quando você reabre o Orla.
- Navegação HTTP(S) em webviews nativas e controles de histórico por aba. O Orla salva localmente os endereços, a aba selecionada e uma cópia anterior da sessão para recuperação. Ao reiniciar, carrega a aba selecionada e deixa as demais aguardando seleção. O histórico de voltar e avançar recomeça com cada nova execução.
- O painel de abas permite buscar entre as abertas e reabrir a última aba fechada, inclusive após reiniciar. A estrela na barra adiciona ou remove páginas dos favoritos da nova aba.
- No Windows, use Ctrl+L para focar a barra de endereço, Ctrl+T para abrir aba, Ctrl+W para fechar e Ctrl+Shift+T para reabrir, inclusive com foco dentro de um site. Use as setas e Enter para escolher sugestões locais.
- **Espaços de trabalho** organizam abas e fixados pela lateral. É possível criar e renomear espaços, mover a aba atual e excluir espaços vazios. O Orla restaura cada conjunto e o último espaço ativo. Favoritos e histórico são compartilhados.
- Em **Retomar → Sessões salvas**, guarde e reabra cópias das abas, dos fixados e das notas de um espaço. É possível exportar e importar os arquivos JSON do Orla. Cada sessão reaberta aparece em um novo espaço.
- A barra de endereços procura abas e nomes de espaços. Os favoritos podem ser importados de um arquivo HTML exportado por outro navegador. As pastas do arquivo viram favoritos na lista única.
- A barra sugere abas abertas, favoritos e visitas locais. O painel **Retomar** inclui as últimas 500 visitas, com filtro e opções de apagar uma visita ou limpar tudo.
- Digite uma pesquisa na barra ou na Nova Aba para abrir a **Busca do Orla**. Em **Configurar provedor**, informe o endereço de uma instância SearXNG com JSON ativado em `search.formats`. O Orla envia apenas a consulta confirmada e oferece o DuckDuckGo como ação separada. Um provedor HTTPS remoto ou uma instância HTTP no próprio computador são aceitos. O Orla não inclui uma instância SearXNG hospedada.
- Abra o **DevTools** integrado com **F12**, **Ctrl+Shift+I** ou pelo botão na barra. O painel inferior inspeciona o DOM e os estilos computados, exibe mensagens do console e permite executar JavaScript na aba ativa. **Rede** lista as requisições capturadas enquanto o painel está aberto.
- O painel Agente é apenas informativo. A interface local tem permissões próprias e os webviews de sites não recebem acesso aos comandos do aplicativo.
- Links HTTP(S) que pedem uma nova janela em resposta a uma ação do usuário abrem uma aba. Pop-ups automáticos continuam bloqueados. O histórico de downloads persiste entre execuções e permite acompanhar, cancelar e localizar arquivos concluídos. Um download deixado em andamento aparece como interrompido após reabrir.
- Quando a navegação falhar, a aba mostra **Tentar novamente** e o jogo offline **Sinal de Volta**. Use Espaço, seta para cima ou toque para saltar e coletar sinais. O recorde fica no dispositivo.
- Em **Aparência → Provedor de busca** você pode testar uma instância SearXNG antes de salvá-la. O teste envia a consulta padrão `Orla`.

## Busca na página e extensões

- Use **Ctrl+F** para localizar texto na aba. **Enter** e **Shift+Enter** percorrem as ocorrências. **Esc** fecha a busca.
- Em **Extensões**, selecione a pasta de uma extensão descompactada que contém `manifest.json`. É possível desativá-la, reativá-la e removê-la. Mantenha a pasta no local original.
- O perfil WebView2 dos sites fica separado da interface do Orla. A atualização preserva os dados do Orla, mas os sites podem pedir login novamente. A instalação é por pasta. Dependendo da extensão, recursos que exigem um botão ou pop-up do Chrome podem ficar indisponíveis.
