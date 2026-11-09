import { timingSafeEqual } from "node:crypto";

const REPO = "dudefitbro-droid/Shubham-Gaming-Hub";
const FILE = "games.json";

function authorized(req) {
  const savedPassword = process.env.ADMIN_PASSWORD;
  const enteredPassword = req.headers["x-admin-password"];

  if (!savedPassword || typeof enteredPassword !== "string") {
    return false;
  }

  const a = Buffer.from(savedPassword);
  const b = Buffer.from(enteredPassword);

  return a.length === b.length && timingSafeEqual(a, b);
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE}`,
        { headers: githubHeaders() }
      );

      if (response.status === 404) {
        return res.status(200).json([]);
      }

      if (!response.ok) {
        return res.status(500).json({ error: "GitHub read failed" });
      }

      const data = await response.json();
      const games = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf8")
      );

      if (!Array.isArray(games)) {
        return res.status(500).json({ error: "Invalid games data" });
      }

      return res.status(200).json(games);
    } catch {
      return res.status(500).json({ error: "Could not load games" });
    }
  }

  if (req.method === "POST") {
    if (!authorized(req)) {
      return res.status(401).json({ error: "Unauthorized admin" });
    }

    if (!process.env.GITHUB_TOKEN) {
      return res.status(500).json({ error: "GitHub token missing" });
    }

    const { title, image, category, url } = req.body || {};

    if (
      typeof title !== "string" ||
      typeof image !== "string" ||
      typeof category !== "string" ||
      typeof url !== "string" ||
      !title.trim() ||
      !image.trim() ||
      !category.trim() ||
      !url.trim()
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (title.length > 100 || category.length > 50) {
      return res.status(400).json({ error: "Text is too long" });
    }

    try {
      for (const value of [image, url]) {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Invalid URL" });
        }
      }

      const endpoint =
        `https://api.github.com/repos/${REPO}/contents/${FILE}`;

      const existing = await fetch(endpoint, {
        headers: githubHeaders()
      });

      let games = [];
      let sha;

      if (existing.ok) {
        const oldFile = await existing.json();
        sha = oldFile.sha;
        games = JSON.parse(
          Buffer.from(oldFile.content, "base64").toString("utf8")
        );

        if (!Array.isArray(games)) {
          return res.status(500).json({ error: "Invalid games file" });
        }
      } else if (existing.status !== 404) {
        return res.status(500).json({ error: "Could not read games file" });
      }

      games.push({
        title: title.trim(),
        image: image.trim(),
        category: category.trim(),
        url: url.trim()
      });

      const content = Buffer.from(
        JSON.stringify(games, null, 2)
      ).toString("base64");

      const saved = await fetch(endpoint, {
        method: "PUT",
        headers: {
          ...githubHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Add game from admin panel",
          content,
          ...(sha ? { sha } : {})
        })
      });

      if (!saved.ok) {
        return res.status(500).json({ error: "GitHub save failed" });
      }

      return res.status(201).json({
        success: true,
        message: "Game saved permanently"
      });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
