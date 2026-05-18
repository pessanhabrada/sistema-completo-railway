import fs from 'fs';
import path from 'path';

const DATA_FILE = path.resolve(process.cwd(), 'data_sessions.json');

export interface ClientSession {
  sessionId: string;
  socketId: string | null;
  operatorSocketId: string | null;
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
  mensagensBia: Array<{ de: "operador" | "cliente"; texto: string; ts: number }>;
  avatarBia: string;
  nomeEnviado: string;
  serialEnviado: string;
  qrCodeEnviado: string;
  referencia: string;
}

export function loadSessions(): Map<string, ClientSession> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (err) {
    console.error('[PERSISTENCE] Erro ao carregar sessões:', err);
  }
  return new Map();
}

export function saveSessions(sessions: Map<string, ClientSession>) {
  try {
    const obj = Object.fromEntries(sessions);
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[PERSISTENCE] Erro ao salvar sessões:', err);
  }
}
