const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");
const REDIS_URL = process.env.REDIS_URL || process.env.RENDER_KV_URL || "";

const defaultState = () => ({
  homeName: "HOME",
  awayName: "VISITOR",
  homeScore: 0,
  awayScore: 0,
  inning: 1,
  half: "TOP",
  balls: 0,
  strikes: 0,
  outs: 0,
  homePitchCount: 0,
  awayPitchCount: 0,
  updatedAt: Date.now()
});

const rooms = new Map();
const clients = new Map();
let redisClient = null;
let redisReady = false;
let redisStarted = false;

async function startRedis() {
  if (redisStarted || !REDIS_URL) return;
  redisStarted = true;

  try {
    const { createClient } = require("redis");
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", err => {
      redisReady = false;
      console.error("Redis error:", err.message);
    });
    redisClient.on("ready", () => {
      redisReady = true;
      console.log("Redis persistence connected");
    });
    await redisClient.connect();
  } catch (err) {
    redisReady = false;
    redisClient = null;
    console.error("Redis persistence disabled:", err.message);
  }
}

function stateKey(room) {
  return `scoreboard:${room}`;
}

async function getState(room) {
  if (rooms.has(room)) return rooms.get(room);

  if (!rooms.has(room)) rooms.set(room, defaultState());
  await startRedis();

  if (redisReady && redisClient) {
    try {
      const saved = await redisClient.get(stateKey(room));
      if (saved) {
        const state = { ...defaultState(), ...JSON.parse(saved) };
        rooms.set(room, state);
      }
    } catch (err) {
      console.error(`Unable to load ${room} from Redis:`, err.message);
    }
  }

  return rooms.get(room);
}

async function saveState(room, state) {
  await startRedis();

  if (redisReady && redisClient) {
    try {
      await redisClient.set(stateKey(room), JSON.stringify(state));
    } catch (err) {
      console.error(`Unable to save ${room} to Redis:`, err.message);
    }
  }
}

function roomClients(room) {
  if (!clients.has(room)) clients.set(room, new Set());
  return clients.get(room);
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function broadcast(room) {
  const state = await getState(room);
  for (const res of roomClients(room)) {
    sendEvent(res, "scoreboard", state);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function cleanRoom(value) {
  return String(value || "FIELD1").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "FIELD1";
}

async function patchState(room, patch) {
  const state = await getState(room);

  if (typeof patch.homeName === "string") state.homeName = patch.homeName.slice(0, 16).toUpperCase() || "HOME";
  if (typeof patch.awayName === "string") state.awayName = patch.awayName.slice(0, 16).toUpperCase() || "VISITOR";
  if (patch.homeScore !== undefined) state.homeScore = clamp(patch.homeScore, 0, 99);
  if (patch.awayScore !== undefined) state.awayScore = clamp(patch.awayScore, 0, 99);
  if (patch.inning !== undefined) state.inning = clamp(patch.inning, 1, 99);
  if (patch.half === "TOP" || patch.half === "BOT") state.half = patch.half;
  if (patch.balls !== undefined) state.balls = clamp(patch.balls, 0, 3);
  if (patch.strikes !== undefined) state.strikes = clamp(patch.strikes, 0, 2);
  if (patch.outs !== undefined) state.outs = clamp(patch.outs, 0, 2);
  if (patch.homePitchCount !== undefined) state.homePitchCount = clamp(patch.homePitchCount, 0, 999);
  if (patch.awayPitchCount !== undefined) state.awayPitchCount = clamp(patch.awayPitchCount, 0, 999);
  if (patch.reset === true) {
    rooms.set(room, defaultState());
  } else {
    state.updatedAt = Date.now();
  }

  const next = rooms.get(room);
  await saveState(room, next);
  await broadcast(room);
  return next;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/" || pathname === "/display" || pathname === "/control" || pathname === "/hub") pathname = "/index.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const type = ext === ".css" ? "text/css" : ext === ".js" ? "application/javascript" : "text/html";
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = cleanRoom(url.searchParams.get("room"));

  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    sendEvent(res, "scoreboard", await getState(room));
    const set = roomClients(room);
    set.add(res);
    req.on("close", () => set.delete(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/state") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(await getState(room)));
    return;
  }

  if (req.method === "POST" && url.pathname === "/state") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 20_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const next = await patchState(room, JSON.parse(body || "{}"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(next));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Scoreboard running at http://localhost:${PORT}`);
});
