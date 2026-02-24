module.exports = async (req, res) => {
  try {
    const WP_URL = process.env.WP_URL;
    const WP_USER = process.env.WP_USER;
    const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

    if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
      return res.status(200).json({
        ok: false,
        message: "WP env is not set",
        wpUrlSet: !!WP_URL,
        wpUserSet: !!WP_USER,
        wpAppPassSet: !!WP_APP_PASSWORD,
      });
    }

    const basic = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");
    const endpoint = `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2/posts`;

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "User-Agent": "stream-press-bot/1.0",
      },
      body: JSON.stringify({
        title: "wp-test from vercel",
        content: "<p>hello</p>",
        status: "draft",
      }),
    });

    const text = await r.text();
    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      bodyHead: text.slice(0, 300),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
