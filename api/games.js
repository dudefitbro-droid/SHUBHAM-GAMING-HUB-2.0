export default async function handler(req, res) {
  const TOKEN = process.env.GITHUB_TOKEN;
  const REPO = "dudefitbro-droid/Shubham-Gaming-Hub";
  const FILE = "games.json";

  if (req.method === "GET") {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE}`,
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: "application/vnd.github+json"
          }
        }
      );

      if (response.status === 404) {
        return res.status(200).json([]);
      }

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: "GitHub read failed" });
      }

      const games = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf8")
      );

      return res.status(200).json(games);
    } catch {
      return res.status(500).json({ error: "Could not load games" });
    }
  }

  if (req.method === "POST") {
    const { title, image, category, url } = req.body || {};

    if (!title || !image || !category || !url) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!/^https?:\/\//i.test(image) || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    try {
      const getFile = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE}`,
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: "application/vnd.github+json"
          }
        }
      );

      let games = [];
      let sha;

      if (getFile.ok) {
        const oldFile = await getFile.json();
        sha = oldFile.sha;
        games = JSON.parse(
          Buffer.from(oldFile.content, "base64").toString("utf8")
        );
      }

      games.push({ title, image, category, url });

      const content = Buffer.from(
        JSON.stringify(games, null, 2)
      ).toString("base64");

      const save = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: "Add game from admin panel",
            content,
            ...(sha ? { sha } : {})
          })
        }
      );

      if (!save.ok) {
        return res.status(500).json({ error: "Game could not be saved" });
      }

      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
