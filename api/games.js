import { timingSafeEqual, randomUUID } from "node:crypto";

const OWNER = process.env.OWNER || "dudefitbro-droid";
const REPO = process.env.REPO || "Shubham-Gaming-Hub";
const FILE = "games.json";

function authorized(req) {
  const saved = process.env.ADMIN_PASSWORD;
  const entered = req.headers["x-admin-password"];

  if (!saved || typeof entered !== "string") return false;

  const a = Buffer.from(saved);
  const b = Buffer.from(entered);

  return a.length === b.length && timingSafeEqual(a, b);
}

function headers() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function validUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function readGames() {
  const endpoint =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;

  const response = await fetch(endpoint, { headers: headers() });

  if (response.status === 404) return { games: [], sha: null };

  if (!response.ok) throw new Error("GitHub read failed");

  const data = await response.json();
  const games = JSON.parse(
    Buffer.from(data.content, "base64").toString("utf8")
  );

  if (!Array.isArray(games)) throw new Error("Invalid games file");

  return {
    games: games.map((g, i) => ({
      id: g.id || `legacy-${i}-${Buffer.from(g.url || g.title || "").toString("base64url")}`,
      title: g.title || g.name || "Untitled",
      image: g.image || "",
      category: g.category || "Other",
      url: g.url || ""
    })),
    sha: data.sha
  };
}

async function saveGames(games, sha, message) {
  const endpoint =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      ...headers(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(
        JSON.stringify(games, null, 2)
      ).toString("base64"),
      ...(sha ? { sha } : {})
    })
  });

  if (response.status === 409 || response.status === 422) {
    throw new Error("GitHub file changed. Please refresh and try again.");
  }

  if (!response.ok) throw new Error("GitHub save failed");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const { games } = await readGames();
      return res.status(200).json(games);
    }

    if (!["POST", "PUT", "DELETE"].includes(req.method)) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!authorized(req)) {
      return res.status(401).json({ error: "Unauthorized admin" });
    }

    if (!process.env.GITHUB_TOKEN) {
      return res.status(500).json({ error: "GITHUB_TOKEN missing" });
    }

    const { games, sha } = await readGames();

    if (req.method === "POST" || req.method === "PUT") {
      const { id, title, image, category, url } = req.body || {};

      if (
        typeof title !== "string" ||
        typeof image !== "string" ||
        typeof category !== "string" ||
        typeof url !== "string" ||
        !title.trim() || !image.trim() ||
        !category.trim() || !url.trim()
      ) {
        return res.status(400).json({ error: "All fields are required" });
      }

      if (
        title.length > 100 ||
        category.length > 50 ||
        image.length > 2000 ||
        url.length > 2000 ||
        !validUrl(image) ||
        !validUrl(url)
      ) {
        return res.status(400).json({ error: "Invalid game details or URL" });
      }

      const game = {
        id: req.method === "PUT" ? id : randomUUID(),
        title: title.trim(),
        image: image.trim(),
        category: category.trim(),
        url: url.trim()
      };

      if (req.method === "POST") {
        games.push(game);
      } else {
        const index = games.findIndex(g => g.id === id);

        if (index === -1) {
          return res.status(404).json({ error: "Game not found" });
        }

        games[index] = game;
      }

      await saveGames(
        games,
        sha,
        req.method === "POST" ? "Add game from owner dashboard" : "Edit game from owner dashboard"
      );

      return res.status(200).json({ success: true, game });
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      const updated = games.filter(g => g.id !== id);

      if (updated.length === games.length) {
        return res.status(404).json({ error: "Game not found" });
      }

      await saveGames(updated, sha, "Delete game from owner dashboard");

      return res.status(200).json({ success: true });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
