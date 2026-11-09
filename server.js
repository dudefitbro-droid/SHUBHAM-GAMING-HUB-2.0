import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD environment variable missing");
}

const DATA_FILE = path.join(process.cwd(), "games.json");

function readGames() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveGames(games) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2));
}

const sessions = new Set();

app.post("/api/admin/login", (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(token);

  res.json({ token });
});

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

app.get("/api/games", (req, res) => {
  res.json(readGames());
});

app.post("/api/games", auth, (req, res) => {
  const { name, image, category, url } = req.body;

  if (!name || !image || !category || !url) {
    return res.status(400).json({ error: "All fields required" });
  }

  const games = readGames();

  const game = {
    id: crypto.randomUUID(),
    name,
    image,
    category,
    url
  };

  games.push(game);
  saveGames(games);

  res.json({ success: true, game });
});

app.delete("/api/games/:id", auth, (req, res) => {
  const games = readGames();
  const updated = games.filter(g => g.id !== req.params.id);

  if (updated.length === games.length) {
    return res.status(404).json({ error: "Game not found" });
  }

  saveGames(updated);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Gaming Hub server running on ${PORT}`);
});
