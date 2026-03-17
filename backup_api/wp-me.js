module.exports = async (req, res) => {
  try {
    const base = (process.env.WP_URL || "").trim().replace(/\/$/, "");
    const user = (process.env.WP_USER || "").trim();
    const pass = (process.env.WP_APP_PASSWORD || "").trim();

    if (!base || !user || !pass) {
      return res.status(500).json({
        error: "env_missing",
        base: !!base,
        user: !!user,
        pass: !!pass,
      });
    }

    const token = Buffer.from(user + ":" + pass).toString("base64");

    const r = await fetch(base + "/wp-json/wp/v2/users/me", {
      method: "GET",
      headers: {
        Authorization: "Basic " + token,
        Accept: "application/json",
      },
    });

    const text = await r.text();

    res.status(200).json({
      status: r.status,
      bodyHead: text.slice(0, 400),
    });

  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
