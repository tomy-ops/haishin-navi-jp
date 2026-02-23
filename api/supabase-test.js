module.exports = async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return res.status(500).json({ error: "env_missing", urlSet: !!url, keySet: !!key });
    }

    // 接続テスト：articles を 1件だけ読む（存在しなくても空で返る）
    const endpoint = `${url}/rest/v1/articles?select=id,title&limit=1`;

    const r = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    const text = await r.text();

    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      endpoint,
      bodyHead: text.slice(0, 300),
    });
  } catch (e) {
    return res.status(500).json({
      error: "fetch_failed",
      name: e?.name,
      message: e?.message,
      cause: String(e?.cause || ""),
    });
  }
};