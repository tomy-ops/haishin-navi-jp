export default async function handler(req, res) {
  try {
    const base = process.env.WP_URL;
    const user = process.env.WP_USER;
    const pass = process.env.WP_APP_PASSWORD;

    if (!base || !user || !pass) {
      return res.status(500).json({
        error: "Environment variables missing",
        base: !!base,
        user: !!user,
        pass: !!pass
      });
    }

    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    const response = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (VercelBot)"
      },
      body: JSON.stringify({
        title: "vercel test",
        content: "hello from vercel",
        status: "draft"
      })
    });

    const text = await response.text();

    return res.status(200).json({
      status: response.status,
      bodyHead: text.slice(0, 500)
    });

  } catch (error) {
    return res.status(500).json({
      error: String(error)
    });
  }
}
