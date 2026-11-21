# Site do Orla Browser

A landing page é estática e independente do aplicativo desktop. Para abrir uma prévia a partir da raiz do repositório:

```sh
python3 -m http.server 4173 --directory website
```

Acesse http://localhost:4173. Para publicar, use a pasta `website/` como raiz do site. Ela não precisa de dependências, etapa de build ou servidor de aplicação.

A demonstração usa dados de exemplo. O efeito topográfico usa WebGL em telas maiores com mouse e tem uma versão em SVG para dispositivos móveis, ambientes sem suporte a WebGL e a preferência de movimento reduzido.

O botão de download aponta para um artefato de teste do GitHub Actions. Quando a distribuição pública estiver disponível, atualize o destino do botão e as instruções de download em `index.html`.
