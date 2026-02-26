// api/wp-test.js
module.exports = async (req, res) => {
  try {
    const base = (process.env.WP_URL || "").trim().replace(/\/$/, "");
    const user = (process.env.WP_USER || "").trim();
    const pass = (process.env.WP_APP_PASSWORD || "").trim();

    if (!base || !user || !pass) {
      return res.status(500).json({
        error: "Environment variables missing",
        base: !!base,
        user: !!user,
        pass: !!pass,
      });
    }

    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    const response = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Accept": "application/json",
        // 変にBotっぽくしない
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    const text = await response.text();

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      bodyHead: text.slice(0, 500),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};