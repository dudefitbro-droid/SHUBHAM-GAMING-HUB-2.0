
import { randomUUID } from "node:crypto";

const OWNER = process.env.GITHUB_OWNER || "dudefitbro-droid";
const REPO = process.env.GITHUB_REPO || "Shubham-Gaming-Hub";
const FILE = "games.json";

const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;

async function github(method, body) {
  const response = await fetch(API, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "GitHub API error");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function readGames() {
  try {
    const data = await github("GET");

    return {
      games: JSON.parse(
        Buffer.from(data.content, "base64").toString("utf8")
      ),
      sha: data.sha
    };
  } catch (error) {
    if (error.status === 404) {
      return { games: [], sha: null };
    }
    throw error;
  }
}

async function saveGames(games, sha) {
  const content = Buffer.from(
    JSON.stringify(games, null, 2)
  ).toString("base64");

  const body = {
    message: "Update SHUBHAM GAMING HUB games",
    content
  };

  if (sha) body.sha = sha;

  await github("PUT", body);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (!process.env.GITHUB_TOKEN ||
        !process.env.ADMIN_PASSWORD) {
      return res.status(500).json({
        error: "Missing environment variables"
      });
    }

    if (req.method === "GET") {
      const data = await readGames();
      return res.status(200).json(data.games);
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const password = req.headers["x-admin-password"];

    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const { action, game, id } = req.body || {};

    if (action === "auth") {
      return res.status(200).json({ success: true });
    }

    const data = await readGames();
    let games = data.games;

    if (!Array.isArray(games)) {
      throw new Error("Invalid games.json format");
    }

    if (action === "add") {
      if (!game?.title || !game?.image || !game?.url) {
        return res.status(400).json({
          error: "Missing game details"
        });
      }

      games.push({
        id: randomUUID(),
        title: game.title,
        image: game.image,
        category: game.category || "Other",
        url: game.url
      });

    } else if (action === "update") {
      const index = games.findIndex(
        item => String(item.id) === String(game?.id)
      );

      if (index === -1) {
        return res.status(404).json({
          error: "Game not found"
        });
      }

      games[index] = {
        ...games[index],
        title: game.title,
        image: game.image,
        category: game.category || "Other",
        url: game.url
      };

    } else if (action === "delete") {
      const updated = games.filter(
        item => String(item.id) !== String(id)
      );

      if (updated.length === games.length) {
        return res.status(404).json({
          error: "Game not found"
        });
      }

      games = updated;

    } else {
      return res.status(400).json({
        error: "Invalid action"
      });
    }

    await saveGames(games, data.sha);

    return res.status(200).json({
      success: true,
      games
    });

  } catch (error) {
    console.error("GAMES API ERROR:", error);

    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
