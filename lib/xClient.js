const crypto = require("crypto");
const { buildXPostText } = require("./xPostBuilder");

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

  const authHeader =
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key])}"`)
      .join(", ");

  return authHeader;
}

async function postArticleToX({ title, url, imageUrl = null }) {
  const postText = buildXPostText({ title, url });

  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_KEY_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return {
      ok: false,
      skipped: true,
      reason: "x_env_missing",
      text: postText,
      imageUrl,
    };
  }

  const endpoint = "https://api.x.com/2/posts";

  const authHeader = buildOauthHeader({
    method: "POST",
    url: endpoint,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: postText,
    }),
  });

  const raw = await res.text();

  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: raw.slice(0, 500),
      text: postText,
      imageUrl,
    };
  }

  const postId = json?.data?.id || null;

  return {
    ok: true,
    status: res.status,
    text: postText,
    imageUrl,
    xPostId: postId,
    raw: json,
  };
}

module.exports = {
  postArticleToX,
};