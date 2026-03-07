module.exports = async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return res.status(500).json({
        error: "env_missing",
        url: !!url,
        key: !!key,
      });
    }

    const payload = [{
      title: "supabase insert test",
      slug: "supabase-insert-test-" + Date.now(),
      html: "<p>hello</p>",
      source: "tmdb"
    }];

    const r = await fetch(`${url}/rest/v1/articles`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();

    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      bodyHead: text.slice(0, 500),
    });
  } catch (e) {
    return res.status(500).json({
      error: "insert_test_failed",
      message: e?.message || String(e),
      stack: e?.stack || null,
    });
  }
};
