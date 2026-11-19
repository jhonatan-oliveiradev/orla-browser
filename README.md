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

No GitHub Actions, o workflow **Windows installer** executa os testes JavaScript, gera o instalador, instala o Orla em uma pasta temporária e verifica se a janela abre. Após uma execução bem-sucedida, baixe o instalador no artefato **orla-browser-windows-x64**.

## Primeiro recorte

- Nova aba com favoritos de início e interface baseada no [Figma V3](https://www.figma.com/design/z0VTjnV3KAlis2UDNxif9b?node-id=15-29).
- A nova aba oferece **Início**, **Widgets** (hora local e nota salva neste dispositivo) e **Retomar** (páginas abertas e páginas fechadas na sessão atual).
- Arraste o espaço livre da barra superior para mover a janela. Use as bordas e os cantos para redimensionar.
- As abas ficam na lateral. Arraste o divisor ou use as setas do teclado para mudar a largura. O botão na barra de ferramentas recolhe a lateral para mostrar apenas a aba atual. A largura, o estado recolhido e as abas fixadas são restaurados quando você reabre o Orla.
- Navegação HTTP(S) em webviews nativas e controles de histórico por aba. O Orla salva localmente os endereços e a aba selecionada. Ao reiniciar, carrega a aba selecionada e deixa as demais aguardando seleção. O histórico de voltar e avançar recomeça com cada nova execução.
- O painel de abas permite buscar entre as abertas e reabrir a última aba fechada na execução atual. A estrela na barra adiciona ou remove páginas dos favoritos da nova aba.
- Com foco na interface do Orla, use Ctrl+L para a barra de endereço, Ctrl+T para abrir aba, Ctrl+W para fechar e Ctrl+Shift+T para reabrir.
- Digite um endereço ou uma pesquisa diretamente na barra superior ou no campo da Nova Aba e pressione Enter. As pesquisas abrem no DuckDuckGo. Morphic e o agente ainda não estão integrados.
- O painel Agente é apenas informativo. A interface local tem permissões próprias e os webviews de sites não recebem acesso aos comandos do aplicativo.
- Pop-ups são bloqueados. Permissões WebView2 adicionais e atalhos com foco no site ficam para uma rodada posterior.
