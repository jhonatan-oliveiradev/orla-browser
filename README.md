# Orla Browser

Orla é um navegador desktop para Windows com uma barra compacta e abas recolhíveis.

## Rodar no Windows

Instale Node.js, Rust com a toolchain MSVC, os componentes C++ do Visual Studio Build Tools e o WebView2 Runtime. Na raiz do repositório:

```powershell
npm ci
npm run dev
```

`npm run build` compila o executável sem empacotar um instalador. `npm run check` valida os scripts e as regras de interpretação da barra de endereço.

## Primeiro recorte

- Nova aba com favoritos de início e interface baseada no [Figma V3](https://www.figma.com/design/z0VTjnV3KAlis2UDNxif9b?node-id=15-29).
- Navegação HTTP(S) em webviews nativas e controles de histórico por aba. O Orla salva localmente os endereços e a aba selecionada. Ao reiniciar, carrega a aba selecionada e deixa as demais aguardando seleção. O histórico de voltar e avançar recomeça com cada nova execução.
- O painel de abas permite buscar entre as abertas e reabrir a última aba fechada na execução atual. A estrela na barra adiciona ou remove páginas dos favoritos da nova aba.
- Com foco na interface do Orla, use Ctrl+L para a barra de endereço, Ctrl+T para abrir aba, Ctrl+W para fechar e Ctrl+Shift+T para reabrir.
- A barra abre endereços e envia consultas ao DuckDuckGo. Morphic e o agente ainda não estão integrados.
- O painel Agente é apenas informativo. A interface local tem permissões próprias e os webviews de sites não recebem acesso aos comandos do aplicativo.
- Pop-ups são bloqueados. Permissões WebView2 adicionais e atalhos com foco no site ficam para uma rodada posterior.
