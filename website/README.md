# Site do Orla Browser

Esta aplicação Next.js usa o App Router, React, TypeScript, Tailwind CSS e Motion. Ela é independente do aplicativo desktop.

```sh
cd website
npm ci
npm run dev
```

Acesse http://localhost:3000. Para validar a compilação de produção, execute `npm run build`.

Na Vercel, selecione o preset **Next.js** e configure `website` como **Root Directory**. Use Node.js 22 ou posterior. A página não depende de banco de dados nem de credenciais.

O botão usa o artefato de prévia do Windows x64 no GitHub Actions. Configure `ORLA_DOWNLOAD_URL` e revise as instruções da página quando houver um instalador de distribuição pública.

Os dados na demonstração são fictícios. A ilustração do hero é uma imagem local otimizada pelo Next.js. A refração em WebGL carrega em segundo plano em telas maiores com mouse. A imagem permanece visível em telas menores e quando o navegador desativa o efeito.
