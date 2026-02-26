// api/wp-test.js
export default async function handler(req, res) {
  try {
    const base = (process.env.WP_URL || "").replace(/\/$/, "");
    const user = process.env.WP_USER || "";
    const pass = process.env.WP_APP_PASSWORD || "";

    if (!base || !user || !pass) {
      return res.status(500).json({
        error: "Environment variables missing",
        base: !!base,
        user: !!user,
        pass: !!pass,
      });
    }

    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    // まずは GET users/me（一番わかりやすい）
    const r = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "User-Agent": "haishin-navi-jp-vercel",
      },
    });

    const text = await r.text();
    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      bodyHead: text.slice(0, 500),
      usedBaseHost: new URL(base).host,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}