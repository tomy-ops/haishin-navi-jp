// api/batch.js
// 1) TMDBから人気作品を取得
// 2) 作品ごとに記事HTMLを生成（OpenAI）
// 3) Supabaseに保存（slug重複はスキップ）

const affiliateLinks = require("../lib/affiliateLinks");

function slugifyJP(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
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
      status: "draft",
      slug,
      featured_image_url: poster || null,
      categories: categories || [],
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

  const tvItems = (tvJson.results || [])
    .filter((x) => x.name)
    .map((x) => ({
      title: x.name,
      mediaType: "tv",
      posterPath: x.poster_path || null,
    }));

  const movieItems = (movieJson.results || [])
    .filter((x) => x.title)
    .map((x) => ({
      title: x.title,
      mediaType: "movie",
      posterPath: x.poster_path || null,
    }));

  const merged = [...tvItems, ...movieItems];

  const unique = [];
  const seen = new Set();

  for (const item of merged) {
    if (seen.has(item.title)) continue;
    seen.add(item.title);
    unique.push(item);
  }

  return unique
    .filter(
      (x) =>
        x.title.length < 80 &&
        !/news|live|tonight|late show|tagesschau/i.test(x.title)
    )
    .slice(0, 10);
}

async function callOpenAI({ title }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const prompt = `
あなたは日本の配信情報メディア編集者です。
次の作品について、配信先を断定せずに紹介記事として使える文章パーツを作ってください。

【重要ルール】
- 配信サービス名を断定で書かない（「〜で配信中」と言い切らない）
- 事実不明なことは推測しない
- 作品名以外の年・キャスト・制作会社などは断定しない
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
      Authorization: `Bearer ${apiKey}`,
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

  const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(
    title
  )}&language=ja-JP`;

  const r = await fetch(url);
  if (!r.ok) return null;

  const j = await r.json();
  const poster = j.results?.[0]?.poster_path;

  if (!poster) return null;

  return `https://image.tmdb.org/t/p/w500${poster}`;
}

function detectCategories({ title, mediaType }) {
  const categories = ["配信どこ"];

  if (mediaType === "movie") {
    categories.push("映画");
  }

  if (mediaType === "tv") {
    categories.push("海外ドラマ");
  }

  if (/アニメ|プリキュア|ガンダム|ポケモン|ドラゴンボール|ワンピース|名探偵コナン|呪術廻戦|鬼滅の刃|SPY×FAMILY/i.test(title)) {
    categories.push("アニメ");
  }

  return Array.from(new Set(categories));
}

function renderWpButton(url, label, bgColor, textColor = "#ffffff") {
  return `
  <div class="wp-block-buttons is-layout-flex" style="justify-content:center;margin:24px 0;">
    <div class="wp-block-button">
      <a class="wp-block-button__link wp-element-button"
         href="${url}"
         target="_blank"
         rel="nofollow sponsored noopener"
         style="border-radius:6px;background-color:${bgColor};color:${textColor};text-decoration:none;">
         ${label}
      </a>
    </div>
  </div>
  `;
}

function renderHtml({ title, ai, poster }) {
  return `
<div style="max-width:760px;margin:24px auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.9;padding:0 16px;">

  ${poster ? `<img src="${poster}" alt="${title}" style="width:100%;max-width:420px;display:block;margin:0 auto 24px;border-radius:12px;">` : ""}

  <h1>${title}の配信はどこ？見逃し・サブスク・無料視聴できる動画サービスまとめ</h1>

  <p>${ai.lead}</p>

  <h2>${title}の配信はどこで見れる？</h2>
  <p>
    ${title}を見たいけれど、どの動画配信サービスで配信されているのか気になる方も多いのではないでしょうか。
    配信ラインナップは時期によって変わるため、最新情報は各サービスの公式サイトで確認するのがおすすめです。
  </p>

  <h2>${title}を視聴できる可能性がある動画配信サービス</h2>
  <table style="width:100%;border-collapse:collapse;text-align:center;margin:16px 0 24px;">
    <tr>
      <th style="border:1px solid #ddd;padding:10px;">サービス</th>
      <th style="border:1px solid #ddd;padding:10px;">月額料金</th>
      <th style="border:1px solid #ddd;padding:10px;">無料体験</th>
    </tr>
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">U-NEXT</td>
      <td style="border:1px solid #ddd;padding:10px;">2189円</td>
      <td style="border:1px solid #ddd;padding:10px;">31日</td>
    </tr>
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">DMM TV</td>
      <td style="border:1px solid #ddd;padding:10px;">550円</td>
      <td style="border:1px solid #ddd;padding:10px;">30日</td>
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
    <tr>
      <td style="border:1px solid #ddd;padding:10px;">DAZN</td>
      <td style="border:1px solid #ddd;padding:10px;">プランによる</td>
      <td style="border:1px solid #ddd;padding:10px;">なし</td>
    </tr>
  </table>

  <h2>${title}を無料で見る方法</h2>
  <p>
    無料で視聴したい場合は、無料体験のある動画配信サービスを活用する方法があります。
    ただし、無料体験の有無や対象作品は時期によって変わるため、利用前に必ず公式サイトをご確認ください。
  </p>

  <ul>
    <li>U-NEXT（31日無料体験）</li>
    <li>Amazon Prime Video（30日無料体験）</li>
    <li>DMM TV（無料体験の実施状況は公式確認）</li>
  </ul>

  <h2>おすすめの動画配信サービス</h2>

  <h3>U-NEXT</h3>
  <p>
    U-NEXTは見放題作品数が非常に多く、映画・ドラマ・アニメまで幅広いジャンルを楽しめる動画配信サービスです。
    作品数を重視したい方や、いろいろな作品をまとめて楽しみたい方に向いています。
  </p>
  <div style="text-align:center;margin:24px 0;">
    <form action="${affiliateLinks.unext}" method="get" target="_blank" style="display:inline;">
      <button type="submit"
      style="display:inline-block;padding:14px 28px;background:#e60023;color:#fff;border:2px solid #b8001c;border-radius:6px;box-shadow:0 5px 0 #b8001c;cursor:pointer;font-weight:bold;font-size:16px;line-height:1.4;">
      U-NEXT公式サイトを見る
      </button>
    </form>
  </div>

  <h3>DMM TV</h3>
  <p>
    DMM TVはコスパの良さが魅力の動画配信サービスです。
    とくにアニメ作品をよく見る方や、月額料金を抑えたい方に向いています。
  </p>
  <div style="text-align:center;margin:24px 0;">
    <form action="${affiliateLinks.dmmtv}" method="get" target="_blank" style="display:inline;">
      <button type="submit"
      style="display:inline-block;padding:14px 28px;background:#ff6600;color:#fff;border:2px solid #cc5200;border-radius:6px;box-shadow:0 5px 0 #cc5200;cursor:pointer;font-weight:bold;font-size:16px;line-height:1.4;">
      DMM TV公式サイトを見る
      </button>
    </form>
  </div>

  <h3>Hulu</h3>
  <p>
    Huluは海外ドラマや国内ドラマが充実している動画配信サービスです。
    ドラマ中心で楽しみたい方や、見逃し配信も気になる方におすすめです。
  </p>
  <div style="text-align:center;margin:24px 0;">
    <form action="${affiliateLinks.hulu}" method="get" target="_blank" style="display:inline;">
      <button type="submit"
      style="display:inline-block;padding:14px 28px;background:#1ce783;color:#111;border:2px solid #14b866;border-radius:6px;box-shadow:0 5px 0 #14b866;cursor:pointer;font-weight:bold;font-size:16px;line-height:1.4;">
      Hulu公式サイトを見る
      </button>
    </form>
  </div>

  <h3>Amazon Prime Video</h3>
  <p>
    Amazon Prime Videoはコスパの良い動画配信サービスで、映画やドラマ、アニメも幅広く配信されています。
    できるだけ費用を抑えて楽しみたい方にも向いています。
  </p>
  <div style="text-align:center;margin:24px 0;">
    <form action="${affiliateLinks.prime}" method="get" target="_blank" style="display:inline;">
      <button type="submit"
      style="display:inline-block;padding:14px 28px;background:#0073aa;color:#fff;border:2px solid #005a84;border-radius:6px;box-shadow:0 5px 0 #005a84;cursor:pointer;font-weight:bold;font-size:16px;line-height:1.4;">
      Prime Videoはこちら
      </button>
    </form>
  </div>

  <h2>${title}の見どころ</h2>
  <ul>
    ${ai.highlights.map((x) => `<li>${x}</li>`).join("")}
  </ul>

  <h2>こんな人におすすめ</h2>
  <ul>
    ${ai.recommendedFor.map((x) => `<li>${x}</li>`).join("")}
  </ul>

  <h2>${title}の作品情報</h2>
  <p>
    作品情報は公開時期や配信サービスによって表記が異なる場合があります。
    正確な情報は公式サイトや作品ページで確認するのがおすすめです。
  </p>

  <h2>配信サービスを選ぶポイント</h2>
  <ol>
    <li>見たい作品が配信されているか</li>
    <li>月額料金と無料体験の条件</li>
    <li>画質・同時視聴・ダウンロード機能</li>
    <li>字幕・吹替・対応端末の使いやすさ</li>
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

  <h2>どの動画配信サービスを選ぶか迷ったら</h2>
  <p>
    動画配信サービス選びで迷っている方は、主要サービスを比較したランキングページも参考にしてください。
  </p>
  <p>
    <a href="https://stream-press.com/vod-ranking/">おすすめ動画配信サービスランキングはこちら</a>
  </p>

  <h2>注意点</h2>
  <p>${ai.caution}</p>

  <hr />
  <p style="font-size:12px;opacity:.75;">
    ※当ページは配信可否を保証するものではありません。最新の配信状況は各サービスの公式情報をご確認ください。
  </p>
</div>
`.trim();
}

async function supabaseUpsert({ title, html }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE env is not set");

  const slug = slugifyJP(title) || `title-${Date.now()}`;

  const r = await fetch(`${url}/rest/v1/articles`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ title, slug, html, source: "tmdb" }]),
  });

  if (r.ok) return { saved: true, slug };

  const t = await r.text();
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
    debug.firstTitle = titles[0]?.title || null;

    const results = [];

    for (const item of titles.slice(0, 3)) {
      const title = item.title;
      const mediaType = item.mediaType;

      debug.currentTitle = title;

      let ai;
      try {
        debug.step = "callOpenAI";
        ai = await callOpenAI({ title });
      } catch (e) {
        console.log("AI generation failed:", title, e);
        results.push({
          title,
          mediaType,
          skipped: true,
          reason: "openai_failed",
          error: e?.message || String(e),
        });
        continue;
      }

      let poster = item.posterPath
        ? `https://image.tmdb.org/t/p/w500${item.posterPath}`
        : null;

      if (!poster) {
        debug.step = "fetchTmdbPoster";
        poster = await fetchTmdbPoster(title);
      }

      const categories = detectCategories({ title, mediaType });

      debug.step = "renderHtml";
      const html = renderHtml({ title, ai, poster });

      debug.step = "supabaseUpsert";
      const saved = await supabaseUpsert({ title, html });

      let wpResult = { skipped: true, reason: "duplicate_skip_wp" };

      if (saved.saved) {
        debug.step = "postToWordPress";
        wpResult = await postToWordPress({
          title,
          html,
          slug: saved.slug,
          poster,
          categories,
        });
      }

      results.push({
        title,
        mediaType,
        categories,
        ...saved,
        poster,
        wp: wpResult,
      });
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