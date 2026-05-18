# Guia de Configuração Local (XAMPP / Node.js)

Este sistema pode ser executado localmente em qualquer computador com Node.js instalado.

## Pré-requisitos
- **Node.js** (versão 20 ou superior)
- **PNPM** ou **NPM**

## Como Rodar Localmente

1. **Extraia o conteúdo** para uma pasta (ex: `C:\sistema-admin`).
2. **Abra o terminal** na pasta do projeto.
3. **Instale as dependências**:
   ```bash
   pnpm install
   ```
   *(Ou `npm install` se não tiver pnpm)*
4. **Inicie o servidor**:
   ```bash
   pnpm dev
   ```
5. **Acesse no navegador**:
   - Painel Admin: `http://localhost:3000/admin`
   - Página de Captura: `http://localhost:3000/bradesco`
   - Teste de Conexão: `http://localhost:3000/teste`

## Uso com XAMPP
O XAMPP é focado em PHP/MySQL. Como este sistema usa **Node.js** e **SQLite**, você não precisa do Apache ou MySQL do XAMPP ativos. 
- O SQLite criará um arquivo em `data/sqlite.db` automaticamente.
- O Node.js servirá tudo na porta 3000.

## Estrutura de Pastas
- `server/`: Código do servidor e WebSocket.
- `client/`: Código do painel administrativo (React).
- `client/public/__bridge__/`: Scripts que são injetados na página de captura.
- `data/`: Onde o banco de dados SQLite fica salvo.

## Dicas
- Se quiser mudar a porta, crie um arquivo `.env` e adicione `PORT=8080`.
- O sistema é compatível com o modo "Universal", funcionando tanto em Windows, Linux quanto Mac.
