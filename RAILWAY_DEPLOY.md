# Guia de Deploy no Railway

Este sistema foi simplificado para ser hospedado facilmente no Railway de forma gratuita.

## Passos para Hospedagem

1. **Criar um Repositório no GitHub:**
   - Crie um novo repositório privado no seu GitHub.
   - Envie todos os arquivos desta pasta para o repositório.

2. **Conectar ao Railway:**
   - Acesse [railway.app](https://railway.app/) e faça login com seu GitHub.
   - Clique em "New Project" -> "Deploy from GitHub repo".
   - Selecione o repositório que você criou.

3. **Configurações Automáticas:**
   - O Railway detectará automaticamente o `package.json` e usará os comandos de `build` e `start`.
   - O sistema usará a porta definida pela variável de ambiente `PORT` (o Railway configura isso automaticamente).

4. **Persistência de Dados:**
   - Como o sistema agora usa um arquivo JSON (`data_sessions.json`) para salvar os dados, as sessões serão mantidas enquanto o container estiver rodando.
   - **Nota:** No plano gratuito do Railway, se o container for reiniciado, os dados do arquivo JSON podem ser resetados. Para persistência permanente, seria necessário um volume montado, mas para uso simples, o arquivo JSON atende bem.

## Acesso ao Painel
- **URL do Painel:** `https://seu-app.railway.app/admin`
- **Senha de Acesso:** `151612`

## Acesso do Cliente
- **URL do Cliente:** `https://seu-app.railway.app/cliente`

## Observações
- A lógica original de comunicação via Socket.IO foi mantida integralmente.
- A interface do operador e do cliente permanecem idênticas à versão original.
- O banco de dados SQLite foi removido para simplificar o deploy e evitar dependências de drivers nativos que podem falhar em ambientes de nuvem simples.
