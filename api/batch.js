// api/batch.js
// 1) TMDBから人気作品を取得
// 2) 作品ごとに記事HTMLを生成（OpenAI）
// 3) Supabaseに保存（slug重複はスキップ）

function slugifyJP(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function fetchTmdbTitles() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not set");

  const tvUrl = `https://api.themoviedb.org/3/tv/popular?api_key=${key}&language=ja-JP&page=1&region=JP`;
  const movieUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${key}&language=ja-JP&page=1&region=JP`;

  const [tvRes, movieRes] = await Promise.all([fetch(tvUrl), fetch(movieUrl)]);
  if (!tvRes.ok) throw new Error(`TMDB TV status ${tvRes.status}`);
  if (!movieRes.ok) throw new Error(`TMDB Movie status ${movieRes.status}`);

  const tvJson = await tvRes.json();
  const movieJson = await movieRes.json();

  const tvTitles = (tvJson.results || []).map((x) => x.name).filter(Boolean);
  const movieTitles = (movieJson.results || []).map((x) => x.title).filter(Boolean);

  return Array.from(new Set([...tvTitles, ...movieTitles])).slice(0, 10); // まずは10件で安全運用
}

async function callOpenAI({ title }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const prompt = `
あなたは日本の配信情報メディア編集者です。
次の作品について、配信先を断定せずに紹介記事として使える文章パーツを作ってください。
【重要ルール】
- 配信サービス名を断定で書かない（「〜で配信中」と言い切らない）
- 事実不明なことは推測しない（年・キャスト等も断定しない）
- 出力は必ずJSONのみ

作品名: ${title}

出力JSON:
{
  "lead": "導入文（200〜350字）",
  "highlights": ["見どころ1","見どころ2","見どころ3"],
  "recommendedFor": ["おすすめ1","おすすめ2","おすすめ3"],
  "caution": "注意点（80〜160字）"
}
`.trim();

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      text: { format: { type: "json_object" } },
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${t.slice(0, 300)}`);
  }

  const data = await r.json();
  const jsonText = data.output?.[0]?.content?.[0]?.text || data.output_text;
  return JSON.parse(jsonText);
}

function renderHtml({ title, ai }) {
  return `
<!doctype html><html lang="ja"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}はどこで見れる？配信サービス比較と無料視聴の考え方</title>
</head><body><main style="max-width:760px;margin:24px auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
<h1>『${title}』はどこで見れる？配信サービス比較と無料視聴の考え方</h1>
<p>${ai.lead}</p>

<h2>まず結論：配信状況は公式で確認するのが確実</h2>
<ul><li>配信ラインナップは変わるため、各サービスの公式検索で確認する</li>
<li>無料体験の有無や条件も、公式の最新情報を確認する</li></ul>

<h2>『${title}』の見どころ</h2>
<ul>${ai.highlights.map(x=>`<li>${x}</li>`).join("")}</ul>

<h2>こんな人におすすめ</h2>
<ul>${ai.recommendedFor.map(x=>`<li>${x}</li>`).join("")}</ul>

<h2>配信サービスを選ぶポイント</h2>
<ol><li>見たい作品が多いか</li><li>月額料金と無料体験の条件</li><li>画質・同時視聴・ダウンロード</li><li>字幕/吹替・対応端末</li></ol>

<h2>よくある質問</h2>
<h3>Q. 『${title}』は無料で見れますか？</h3>
<p>A. 無料体験があっても対象外の場合があります。公式で対象作品か確認してください。</p>

<h2>注意点</h2>
<p>${ai.caution}</p>

<hr/><p style="font-size:12px;opacity:.75;">※当ページは配信可否を保証しません。最新は公式をご確認ください。</p>
</main></body></html>
`.trim();
}

async function supabaseUpsert({ title, html }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE env is not set");

  const slug = slugifyJP(title) || `title-${Date.now()}`;

  // Supabase REST APIでinsert（重複slugはエラー→スキップ）
  const r = await fetch(`${url}/rest/v1/articles`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify([{ title, slug, html, source: "tmdb" }]),
  });

  if (r.ok) return { saved: true, slug };

  const t = await r.text();
  // unique違反などはスキップ扱い
  if (t.includes("duplicate key") || t.includes("articles_slug_key")) {
    return { saved: false, slug, reason: "duplicate" };
  }
  throw new Error(`Supabase error ${r.status}: ${t.slice(0, 300)}`);
}

module.exports = async (req, res) => {
  try {
    // 誤爆防止：手動実行時は ?key=... を要求（後でCronでは別にする）
    const guard = process.env.BATCH_GUARD_KEY || "";
    if (guard && req.query.key !== guard) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const titles = await fetchTmdbTitles();
    const results = [];

    for (const title of titles) {
      const ai = await callOpenAI({ title });
      const html = renderHtml({ title, ai });
      const saved = await supabaseUpsert({ title, html });
      results.push({ title, ...saved });
    }

    res.status(200).json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: "batch_failed", message: err?.message || String(err) });
  }
};