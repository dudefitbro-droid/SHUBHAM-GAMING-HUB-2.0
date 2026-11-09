import { timingSafeEqual } from "node:crypto";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const saved = process.env.ADMIN_PASSWORD;
  const entered = req.body?.password;

  if (!saved || typeof entered !== "string") {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const a = Buffer.from(saved);
  const b = Buffer.from(entered);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  return res.status(200).json({ success: true });
}
