export default async function handler(req, res) {
  try {
    const url = (process.env.STREAMPRESS_PUBLISH_URL || "").trim();
    const key = (process.env.STREAMPRESS_PUBLISH_KEY || "").trim();

    if (!url || !key) {
      return res.status(500).json({ error: "env missing", url: !!url, key: !!key });
    }

    const body = {
      title: "vercel publish test",
      content: "<p>hello from vercel publish</p>",
      status: "draft"
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "x-streampress-key": key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      bodyHead: text.slice(0, 300)
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}