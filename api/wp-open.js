module.exports = async (req, res) => {
  try {
    const base = (process.env.WP_URL || "").trim().replace(/\/$/, "");
    if (!base) return res.status(500).json({ error: "WP_URL missing" });

    const r = await fetch(base + "/wp-json/");
    const text = await r.text();

    res.status(200).json({
      status: r.status,
      bodyHead: text.slice(0, 400),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
