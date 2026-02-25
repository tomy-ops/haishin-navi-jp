export default async function handler(req, res) {
  try {
    const baseRaw = (process.env.WP_URL || process.env.WP_BASE_URL || "").trim();
    const user = (process.env.WP_USER || "").trim();
    const pass = (process.env.WP_APP_PASSWORD || "").trim();

    // どの変数が読めてるかの切り分け（値は出さない）
    if (!baseRaw || !user || !pass) {
      return res.status(500).json({
        error: "Environment variables missing",
        WP_URL: !!process.env.WP_URL,
        WP_BASE_URL: !!process.env.WP_BASE_URL,
        base: !!baseRaw,
        user: !!user,
        pass: !!pass,
      });
    }

    const base = baseRaw.replace(/\/$/, ""); // 末尾/を除去
    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    const response = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "User-Agent": "haishin-navi-jp (vercel wp-test)",
      },
    });

    const text = await response.text();

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      bodyHead: text.slice(0, 500),
      usedBaseHost: (() => {
        try { return new URL(base).host; } catch { return ""; }
      })(),
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}