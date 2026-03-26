const affiliateLinks = require("./affiliateLinks");
const { enqueueXPosts } = require("./xQueue");

function slugifyJP(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2brSafe(str = "") {
  return escapeHtml(str).replace(/\r?\n/g, "<br>");
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeArray(arr, fallback = []) {
  if (!Array.isArray(arr)) return fallback;
  return arr.map((x) => String(x || "").trim()).filter(Boolean);
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function buildSlug(title, suffix = "") {
  const base = slugifyJP(title) || "title";
  return `${base}${suffix ? "-" + suffix : ""}`.slice(0, 140);
}

function parseCsvParam(value = "") {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function monthRange(monthStr) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthStr || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, label: `${year}年${month}月` };
}

function jpNowMonth() {
  const d = new Date();
  const jp = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const y = jp.getFullYear();
  const m = jp.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function renderWpButton(url, label, bgColor, textColor = "#ffffff") {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return "";
  return `
  <div class="wp-block-buttons is-layout-flex" style="justify-content:center;margin:24px 0;">
    <div class="wp-block-button">
      <a class="wp-block-button__link wp-element-button"
         href="${escapeHtml(safeUrl)}"
         target="_blank"
         rel="nofollow sponsored noopener"
         style="display:inline-block;padding:14px 28px;border-radius:6px;background-color:${bgColor};color:${textColor};text-decoration:none;font-weight:bold;font-size:16px;line-height:1.4;">
         ${escapeHtml(label)}
      </a>
    </div>
  </div>
  `;
}

function renderServiceTable() {
  return `
  <table style="width:100%;border-collapse:collapse;text-align:center;margin:16px 0 12px;">
    <tr>
      <th style="border:1px solid #ddd;padding:10px;background:#f5f5f5;">サービス</th>
      <th style="border:1px solid #ddd;padding:10px;background:#f5f5f5;">月額料金</th>
      <th style="border:1px solid #ddd;padding:10px;background:#f5f5f5;">無料体験</th>
    </tr>
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">U-NEXT</td>
      <td style="border:1px solid #ddd;padding:10px;">2189円</td>
      <td style="border:1px solid #ddd;padding:10px;">31日</td>
    </tr>
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">DMM TV</td>
      <td style="border:1px solid #ddd;padding:10px;">550円</td>
      <td style="border:1px solid #ddd;padding:10px;">14日</td>
    </tr>
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">Hulu</td>
      <td style="border:1px solid #ddd;padding:10px;">1026円</td>
      <td style="border:1px solid #ddd;padding:10px;">なし</td>
    </tr>
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">Amazon Prime Video</td>
      <td style="border:1px solid #ddd;padding:10px;">600円</td>
      <td style="border:1px solid #ddd;padding:10px;">30日</td>
    </tr>
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">ABEMA</td>
      <td style="border:1px solid #ddd;padding:10px;">プランによる</td>
      <td style="border:1px solid #ddd;padding:10px;">なし</td>
    </tr>
  </table>
  <p style="font-size:13px;color:#666;margin:0 0 24px;line-height:1.8;">
    ※料金や無料体験の条件は変更される可能性があります。必ず各サービスの公式サイトをご確認ください。
  </p>
  `.trim();
}

function renderCommonAffiliateBlock() {
  return `
  <h2>おすすめの動画配信サービス</h2>

  <h3>U-NEXT</h3>
  <p>作品数を重視したい方や、映画・ドラマ・アニメを幅広く探したい方に向いています。</p>
  ${affiliateLinks.unext ? renderWpButton(affiliateLinks.unext, "U-NEXT公式サイトを見る", "#e60023") : ""}

  <h3>DMM TV</h3>
  <p>料金を抑えつつアニメやエンタメ作品も見たい方に向いています。</p>
  ${affiliateLinks.dmmtv ? renderWpButton(affiliateLinks.dmmtv, "DMM TV公式サイトを見る", "#ff6600") : ""}

  <h3>Hulu</h3>
  <p>ドラマ系の作品もあわせてチェックしたい方に向いています。</p>
  ${affiliateLinks.hulu ? renderWpButton(affiliateLinks.hulu, "Hulu公式サイトを見る", "#1ce783", "#111111") : ""}

  <h3>Amazon Prime Video</h3>
  <p>まずは幅広く作品を探したい方やコスパを重視したい方の候補になりやすいです。</p>
  ${affiliateLinks.prime ? renderWpButton(affiliateLinks.prime, "Prime Videoはこちら", "#0073aa") : ""}
  `;
}

async function callOpenAIJson(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      text: { format: { type: "json_object" } },
    }),
  });

  const raw = await r.text();
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${raw.slice(0, 500)}`);

  const data = safeJsonParse(raw, null);
  if (!data) throw new Error(`OpenAI parse failed: ${raw.slice(0, 500)}`);

  const jsonText =
    data.output?.[0]?.content?.[0]?.text ||
    data.output_text ||
    "";

  if (!jsonText) throw new Error(`OpenAI output missing: ${raw.slice(0, 500)}`);

  const parsed = safeJsonParse(jsonText, null);
  if (!parsed) throw new Error(`OpenAI JSON body parse failed: ${jsonText.slice(0, 500)}`);

  return parsed;
}

async function tmdbFetch(path, params = {}) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not set");

  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "ja-JP");

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const r = await fetch(url.toString());
  const text = await r.text();
  if (!r.ok) throw new Error(`TMDB error ${r.status}: ${text.slice(0, 300)}`);
  return safeJsonParse(text, {});
}

async function fetchTmdbPoster(title) {
  const j = await tmdbFetch("/search/multi", { query: title });
  const poster = j.results?.[0]?.poster_path;
  if (!poster) return null;
  return `https://image.tmdb.org/t/p/w500${poster}`;
}

async function searchCollection(title) {
  const j = await tmdbFetch("/search/collection", { query: title });
  return j.results?.[0] || null;
}

async function fetchCollectionParts(collectionId) {
  const j = await tmdbFetch(`/collection/${collectionId}`, {});
  const parts = Array.isArray(j.parts) ? j.parts : [];
  return parts
    .map((x) => ({
      id: x.id,
      title: x.title,
      overview: x.overview || "",
      release_date: x.release_date || "",
      poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : null,
      popularity: x.popularity || 0,
    }))
    .sort((a, b) => String(a.release_date).localeCompare(String(b.release_date)));
}

const CATEGORY_MAP = {
  anime: {
    label: "アニメ",
    mediaType: "tv",
    with_genres: "16",
    categories: ["ランキング", "アニメ"],
  },
  movie_action: {
    label: "アクション映画",
    mediaType: "movie",
    with_genres: "28",
    categories: ["ランキング", "映画"],
  },
  movie_romance: {
    label: "恋愛映画",
    mediaType: "movie",
    with_genres: "10749",
    categories: ["ランキング", "映画"],
  },
  movie_family: {
    label: "ファミリー映画",
    mediaType: "movie",
    with_genres: "10751",
    categories: ["ランキング", "映画"],
  },
  korean_drama: {
    label: "韓国ドラマ",
    mediaType: "tv",
    with_origin_country: "KR",
    categories: ["ランキング", "韓国ドラマ"],
  },
  japanese_drama: {
    label: "国内ドラマ",
    mediaType: "tv",
    with_origin_country: "JP",
    categories: ["ランキング", "国内ドラマ"],
  },
  overseas_drama: {
    label: "海外ドラマ",
    mediaType: "tv",
    without_origin_country: "JP",
    categories: ["ランキング", "海外ドラマ"],
  },
};

async function discoverCategoryItems(categoryKey, page = 1) {
  const conf = CATEGORY_MAP[categoryKey];
  if (!conf) throw new Error(`Unknown category: ${categoryKey}`);

  const path = conf.mediaType === "tv" ? "/discover/tv" : "/discover/movie";
  const params = { sort_by: "popularity.desc", page };

  if (conf.with_genres) params.with_genres = conf.with_genres;
  if (conf.with_origin_country) params.with_origin_country = conf.with_origin_country;
  if (conf.without_origin_country) params.without_origin_country = conf.without_origin_country;

  const j = await tmdbFetch(path, params);
  const results = Array.isArray(j.results) ? j.results : [];

  return results.slice(0, 10).map((x, idx) => ({
    rank: idx + 1,
    id: x.id,
    title: x.title || x.name || "",
    overview: x.overview || "",
    date: x.release_date || x.first_air_date || "",
    poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : null,
    popularity: x.popularity || 0,
  }));
}

async function discoverMonthlyItems({ month, mediaType = "movie", limit = 10 }) {
  const range = monthRange(month);
  if (!range) throw new Error("month must be YYYY-MM");

  const path = mediaType === "tv" ? "/discover/tv" : "/discover/movie";
  const params = { sort_by: "popularity.desc", page: 1 };

  if (mediaType === "tv") {
    params["first_air_date.gte"] = range.start;
    params["first_air_date.lte"] = range.end;
  } else {
    params["release_date.gte"] = range.start;
    params["release_date.lte"] = range.end;
  }

  const j = await tmdbFetch(path, params);
  const results = Array.isArray(j.results) ? j.results : [];

  return {
    label: range.label,
    items: results.slice(0, limit).map((x, idx) => ({
      rank: idx + 1,
      id: x.id,
      title: x.title || x.name || "",
      overview: x.overview || "",
      date: x.release_date || x.first_air_date || "",
      poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : null,
      popularity: x.popularity || 0,
    })),
  };
}

async function postToWordPress({ title, html, slug, poster, categories }) {
  const url = (process.env.STREAMPRESS_PUBLISH_URL || "").trim();
  const key = (process.env.STREAMPRESS_PUBLISH_KEY || "").trim();

  if (!url || !key) {
    return {
      skipped: true,
      reason: "streampress_env_missing",
      url: !!url,
      key: !!key,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-streampress-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      title,
      content: html,
      status: "publish",
      slug,
      featured_image_url: poster || null,
      categories: categories || [],
    }),
  });

  const text = await res.text();
  const json = safeJsonParse(text, null);

  return {
    ok: res.ok,
    status: res.status,
    bodyHead: text.slice(0, 300),
    wpPostId: json?.id || null,
    wpUrl: json?.url || json?.link || null,
  };
}

async function supabaseUpsert({ title, html, slug, source = "manual" }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE env is not set");

  const r = await fetch(`${url}/rest/v1/articles`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ title, slug, html, source }]),
  });

  if (r.ok) {
    const j = await r.json().catch(() => []);
    return {
      saved: true,
      slug,
      row: Array.isArray(j) ? j[0] || null : null,
    };
  }

  const t = await r.text();
  if (t.includes("duplicate key") || t.includes("articles_slug_key")) {
    return { saved: false, slug, reason: "duplicate" };
  }

  throw new Error(`Supabase error ${r.status}: ${t.slice(0, 300)}`);
}

async function publishFlow({ wpTitle, slug, html, poster, categories, source }) {
  const saved = await supabaseUpsert({
    title: wpTitle,
    html,
    slug,
    source,
  });

  let wpResult = { skipped: true, reason: "duplicate_skip_wp" };
  if (saved.saved) {
    wpResult = await postToWordPress({
      title: wpTitle,
      html,
      slug,
      poster,
      categories,
    });
  }

  let xResult = { skipped: true, reason: "wp_not_published" };
  if (wpResult?.ok && wpResult?.wpUrl) {
    xResult = await enqueueXPosts({
      title: wpTitle,
      slug,
      url: wpResult.wpUrl,
    });
  }

  return { saved, wp: wpResult, x: xResult };
}

function ensureAuthorized(req, res) {
  const guard = process.env.BATCH_GUARD_KEY || "";
  if (guard && req.query.key !== guard) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

module.exports = {
  affiliateLinks,
  CATEGORY_MAP,
  buildSlug,
  callOpenAIJson,
  discoverCategoryItems,
  discoverMonthlyItems,
  ensureAuthorized,
  escapeHtml,
  fetchCollectionParts,
  fetchTmdbPoster,
  monthRange,
  jpNowMonth,
  nl2brSafe,
  normalizeArray,
  parseCsvParam,
  publishFlow,
  renderCommonAffiliateBlock,
  renderServiceTable,
  safeJsonParse,
  searchCollection,
  uniq,
};