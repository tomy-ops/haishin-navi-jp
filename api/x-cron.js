// api/x-cron.js
const crypto = require("crypto");

function percentEncode(str = "") {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildOauthHeader({
  method,
  url,
  consumerKey,
  consumerSecret,
  accessToken,
  accessTokenSecret,
}) {
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const sorted = Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauth[key])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sorted),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;

  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  oauth.oauth_signature = signature;

  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key])}"`)
      .join(", ")
  );
}

async function postToX(text) {
  const endpoint = "https://api.x.com/2/posts";

  const authHeader = buildOauthHeader({
    method: "POST",
    url: endpoint,
    consumerKey: process.env.X_API_KEY,
    consumerSecret: process.env.X_API_KEY_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const raw = await res.text();

  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(raw.slice(0, 500));
  }

  return {
    postId: json?.data?.id || null,
    raw: json,
  };
}

module.exports = async (req, res) => {
  try {
    const cronKey = process.env.CRON_SECRET || "";
    if (cronKey && req.query.key !== cronKey) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "supabase_env_missing" });
    }

    const now = new Date().toISOString();

    const q = await fetch(
      `${supabaseUrl}/rest/v1/x_post_queue?status=eq.queued&scheduled_for=lte.${encodeURIComponent(now)}&order=scheduled_for.asc&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const rows = await q.json();

    if (!rows.length) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "no_due_post",
      });
    }

    const row = rows[0];

    let x;
    try {
      x = await postToX(row.post_text);
    } catch (err) {
      await fetch(`${supabaseUrl}/rest/v1/x_post_queue?id=eq.${row.id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "error",
          error_message: err?.message || String(err),
        }),
      });

      throw err;
    }

    await fetch(`${supabaseUrl}/rest/v1/x_post_queue?id=eq.${row.id}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "posted",
        posted_at: new Date().toISOString(),
        x_post_id: x.postId,
      }),
    });

    return res.status(200).json({
      ok: true,
      rowId: row.id,
      xPostId: x.postId,
      articleTitle: row.article_title,
    });
  } catch (err) {
    return res.status(500).json({
      error: "x_cron_failed",
      message: err?.message || String(err),
    });
  }
};