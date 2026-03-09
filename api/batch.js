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

async function postToWordPress({ title, html, slug }) {
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
      status: "draft",
      slug,
    }),
  });

  const text = await res.text();

  return {
    ok: res.ok,
    status: res.status,
    bodyHead: text.slice(0, 300),
  };
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
async function fetchTmdbPoster(title) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;

  const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(title)}&language=ja-JP`;

  const r = await fetch(url);
  if (!r.ok) return null;

  const j = await r.json();
  const poster = j.results?.[0]?.poster_path;

  if (!poster) return null;

  return `https://image.tmdb.org/t/p/w500${poster}`;
}

function renderHtml({ title, ai, poster }) {
  return `
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}の配信はどこ？見逃し・サブスク・無料視聴できる動画サービスまとめ</title>
  <meta name="description" content="${title}の配信はどこで見れるのか気になる方向けに、見逃し配信・サブスク・無料視聴の考え方をわかりやすく整理しました。最新の配信状況を確認するポイントも紹介します。" />
</head>
<body>
  <main style="max-width:760px;margin:24px auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.9;padding:0 16px;">

    ${poster ? `<img src="${poster}" alt="${title}" style="width:100%;max-width:420px;display:block;margin:0 auto 24px;border-radius:12px;">` : ""}

    <h1>${title}の配信はどこ？見逃し・サブスク・無料視聴できる動画サービスまとめ</h1>

    <p>${ai.lead}</p>

    <h2>まず結論：配信状況は公式で確認するのが確実</h2>
    <ul>
      <li>配信ラインナップは変わるため、各サービスの公式検索で確認する</li>
      <li>無料体験の有無や条件も、公式の最新情報を確認する</li>
      <li>字幕・吹替・見逃し配信の対象かどうかもあわせて確認する</li>
    </ul>

    <h2>${title}の見どころ</h2>
    <ul>
      ${ai.highlights.map(x => `<li>${x}</li>`).join("")}
    </ul>

    <h2>こんな人におすすめ</h2>
    <ul>
      ${ai.recommendedFor.map(x => `<li>${x}</li>`).join("")}
    </ul>

    <h2>配信サービスを選ぶポイント</h2>
    <ol>
      <li>見たい作品が多いか</li>
      <li>月額料金と無料体験の条件</li>
      <li>画質・同時視聴・ダウンロードの可否</li>
      <li>字幕・吹替・対応端末が合っているか</li>
    </ol>

    <h2>見逃し配信や無料視聴を探すときの注意点</h2>
    <p>
      「無料で見れる」「見逃し配信がある」と書かれていても、時期やキャンペーン条件によって対象外になることがあります。
      登録前に、対象作品かどうか、無料体験の対象条件、視聴期限の有無を確認しておくと安心です。
    </p>

    <h2>よくある質問</h2>

    <h3>Q. ${title}は無料で見れますか？</h3>
    <p>
      A. 無料体験があるサービスでも、対象外の場合があります。必ず公式で対象作品か確認してください。
    </p>

    <h3>Q. ${title}の見逃し配信を見たいときは？</h3>
    <p>
      A. 見逃し配信は期間限定の場合があります。作品名で検索し、最新の配信状況を公式ページで確認するのが確実です。
    </p>

    <h3>Q. どのサブスクを選べばいいですか？</h3>
    <p>
      A. まずは${title}を視聴できるかを確認し、そのうえで月額料金、無料体験、画質、同時視聴のしやすさを比較するのがおすすめです。
    </p>

    <h2>配信状況を確認したい方へ</h2>
    <p>
      ${title}の配信状況は、時期やキャンペーンによって変更されることがあります。
      見逃し配信や無料体験の対象になる場合もあるため、最新の配信情報は公式ページで確認するのがおすすめです。
    </p>

    <p>
      特に動画配信サービスでは、無料体験の期間中に視聴できる作品が多くあります。
      まずは公式ページで現在の配信状況をチェックしてみてください。
    </p>

    <ul>
      <li><a href="U-NEXTリンク" target="_blank" rel="nofollow sponsored">U-NEXT公式はこちら</a></li>
      <li><a href="DMMTVリンク" target="_blank" rel="nofollow sponsored">DMM TV公式はこちら</a></li>
      <li><a href="Huluリンク" target="_blank" rel="nofollow sponsored">Hulu公式はこちら</a></li>
    </ul>

    <p>
      ※配信作品や無料体験の条件は変更されることがあります。最新情報は各サービスの公式サイトでご確認ください。
    </p>

    <h2>サービス選びで迷ったら</h2>
    <ul>
      <li>映画やドラマを幅広く見たい人は作品数を重視</li>
      <li>無料体験を重視する人は対象条件を確認</li>
      <li>家族で使いたい人は同時視聴台数もチェック</li>
    </ul>

    <h2>注意点</h2>
    <p>${ai.caution}</p>

    <hr />
    <p style="font-size:12px;opacity:.75;">
      ※当ページは配信可否を保証するものではありません。最新の配信状況は各サービスの公式情報をご確認ください。
    </p>
  </main>
</body>
</html>
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
    const guard = process.env.BATCH_GUARD_KEY || "";
    if (guard && req.query.key !== guard) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const debug = {
      step: "start",
      env: {
        tmdb: !!process.env.TMDB_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        supabaseUrl: !!process.env.SUPABASE_URL,
        supabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        publishUrl: !!process.env.STREAMPRESS_PUBLISH_URL,
        publishKey: !!process.env.STREAMPRESS_PUBLISH_KEY,
      },
    };

    debug.step = "fetchTmdbTitles";
    const titles = await fetchTmdbTitles();
    debug.titlesCount = titles.length;
    debug.firstTitle = titles[0] || null;

    const results = [];

    for (const title of titles.slice(0, 5)) {
      debug.currentTitle = title;

      debug.step = "callOpenAI";
      const ai = await callOpenAI({ title });

      debug.step = "fetchTmdbPoster";
      const poster = await fetchTmdbPoster(title);

      debug.step = "renderHtml";
      const html = renderHtml({ title, ai, poster });

      debug.step = "supabaseUpsert";
      const saved = await supabaseUpsert({ title, html });

      let wpResult = { skipped: true, reason: "duplicate_skip_wp" };

      if (saved.saved) {
        debug.step = "postToWordPress";
        wpResult = await postToWordPress({ title, html, slug: saved.slug });
      }

      results.push({ title, ...saved, poster, wp: wpResult });
    }

    return res.status(200).json({
      ok: true,
      debug,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      error: "batch_failed",
      message: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
};