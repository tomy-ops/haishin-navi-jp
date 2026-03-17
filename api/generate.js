const affiliateLinks = require("../lib/affiliateLinks");

function slugifyJP(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
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

function normalizeArray(arr, fallback = []) {
  if (!Array.isArray(arr)) return fallback;
  return arr
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function buildSlug({ title, mediaType }) {
  const base = slugifyJP(title) || "title";
  return `${base}-${mediaType}`.slice(0, 120);
}

function validateAi(ai) {
  if (!ai || typeof ai !== "object") return false;

  const lead = String(ai.lead || "").trim();
  const highlights = normalizeArray(ai.highlights);
  const recommendedFor = normalizeArray(ai.recommendedFor);
  const caution = String(ai.caution || "").trim();

  if (lead.length < 80) return false;
  if (highlights.length < 3) return false;
  if (recommendedFor.length < 3) return false;
  if (caution.length < 40) return false;

  return true;
}

function sanitizeAi(ai) {
  return {
    lead: String(ai?.lead || "").trim(),
    highlights: normalizeArray(ai?.highlights).slice(0, 5),
    recommendedFor: normalizeArray(ai?.recommendedFor).slice(0, 5),
    caution: String(ai?.caution || "").trim(),
  };
}

function isAnimeTitle(title = "") {
  return /アニメ|プリキュア|ガンダム|ポケモン|ドラゴンボール|ワンピース|名探偵コナン|呪術廻戦|鬼滅の刃|SPY×FAMILY|スパイファミリー|クレヨンしんちゃん|ちいかわ|ドラえもん|推しの子/i.test(
    title
  );
}

function isKoreanDramaTitle(title = "") {
  return /愛の不時着|梨泰院クラス|トッケビ|ウ・ヨンウ|キム秘書|太陽の末裔|ペントハウス/i.test(
    title
  );
}

function isJapaneseDramaTitle(title = "") {
  return /相棒|科捜研の女|ドクターX|silent|VIVANT|半沢直樹|アンナチュラル|MIU404/i.test(
    title
  );
}

function detectCategories({ title, mediaType }) {
  const categories = ["配信どこ"];

  const isAnime = isAnimeTitle(title);
  const isKoreanDrama = isKoreanDramaTitle(title);
  const isJapaneseDrama = isJapaneseDramaTitle(title);

  if (mediaType === "movie") {
    categories.push("映画");
  }

  if (isAnime) {
    categories.push("アニメ");
  } else if (mediaType === "tv") {
    if (isKoreanDrama) {
      categories.push("韓国ドラマ");
    } else if (isJapaneseDrama) {
      categories.push("国内ドラマ");
    } else {
      categories.push("海外ドラマ");
    }
  }

  return Array.from(new Set(categories));
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

async function callOpenAI({ title, mediaType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const prompt = `
あなたは日本の配信情報メディア編集者です。
次の作品について、配信先を断定せずに紹介記事で使える文章パーツを作ってください。

【重要ルール】
- 配信サービス名を断定で書かない
- 事実不明なことは推測しない
- 作品名以外の年・キャスト・制作会社・放送局などは断定しない
- 「すでに配信終了」などの断定もしない
- 日本語で自然に書く
- 出力は必ずJSONのみ
- highlights と recommendedFor は各3〜5個
- lead は200〜350字
- caution は80〜160字
- 作品の魅力や視聴の探し方に寄せて書く
- 「配信状況は変動するため公式サイト確認が必要」という前提に沿う

作品名: ${title}
メディア種別: ${mediaType}

出力JSON:
{
  "lead": "導入文",
  "highlights": ["見どころ1","見どころ2","見どころ3"],
  "recommendedFor": ["おすすめ1","おすすめ2","おすすめ3"],
  "caution": "注意点"
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
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  const raw = await r.text();

  if (!r.ok) {
    throw new Error(`OpenAI error ${r.status}: ${raw.slice(0, 500)}`);
  }

  const data = safeJsonParse(raw, null);
  if (!data) {
    throw new Error(`OpenAI response parse failed: ${raw.slice(0, 500)}`);
  }

  const jsonText =
    data.output?.[0]?.content?.[0]?.text ||
    data.output_text ||
    "";

  if (!jsonText) {
    throw new Error(`OpenAI output missing: ${raw.slice(0, 500)}`);
  }

  const parsed = safeJsonParse(jsonText, null);
  if (!parsed) {
    throw new Error(`OpenAI JSON body parse failed: ${jsonText.slice(0, 500)}`);
  }

  const sanitized = sanitizeAi(parsed);

  if (!validateAi(sanitized)) {
    throw new Error(`OpenAI output validation failed: ${jsonText.slice(0, 500)}`);
  }

  return sanitized;
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

  <p style="font-size:13px;color:#666;margin:0 0 24px;line-height:1.8;">
    ※月額料金や無料体験の内容は変更される可能性があります。最新の情報や詳細な条件については、各動画配信サービスの公式サイトをご確認ください。
  </p>
  `.trim();
}

function renderHtml({ title, ai, poster }) {
  const safeTitle = escapeHtml(title);
  const safeLead = nl2brSafe(ai.lead);
  const safeCaution = nl2brSafe(ai.caution);

  const highlightsHtml = ai.highlights
    .map((x) => `<li>${escapeHtml(x)}</li>`)
    .join("");

  const recommendedHtml = ai.recommendedFor
    .map((x) => `<li>${escapeHtml(x)}</li>`)
    .join("");

  return `
<div style="max-width:760px;margin:24px auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.9;padding:0 16px;">

  ${poster ? `<img src="${escapeHtml(poster)}" alt="${safeTitle}" style="width:100%;max-width:420px;display:block;margin:0 auto 24px;border-radius:12px;">` : ""}

  <h1>${safeTitle}を見たい人向け｜配信サービスの探し方とおすすめVOD</h1>

  <p>${safeLead}</p>

  <h2>${safeTitle}を見たい人向けの基本ポイント</h2>
  <p>
    ${safeTitle}を見たいと思ったときは、まず主要な動画配信サービスで作品名検索を行い、
    見放題・レンタル・購入のどれに該当するかを確認するのが基本です。
    配信ラインナップは時期によって変わるため、最新情報は各サービスの公式サイトで確認するのがおすすめです。
  </p>

  <h2>${safeTitle}を探すときに候補になりやすい動画配信サービス</h2>
  <p>
    作品によって配信先は異なりますが、映画・ドラマ・アニメを幅広く扱う主要サービスを見比べると見つけやすくなります。
    まずは下記のような大手サービスをチェックしてみてください。
  </p>

  ${renderServiceTable()}

  <h2>${safeTitle}を無料で見たい場合の考え方</h2>
  <p>
    無料で視聴したい場合は、無料体験のあるサービスやキャンペーンの実施状況を確認する方法があります。
    ただし、無料体験の有無や対象作品は時期によって変わるため、利用前に必ず公式サイトをご確認ください。
  </p>

  <ul>
    <li>無料体験の実施有無を公式サイトで確認する</li>
    <li>見放題対象か、レンタル対象かを確認する</li>
    <li>視聴期限やキャンペーン条件もあわせて確認する</li>
  </ul>

  <h2>おすすめの動画配信サービス</h2>

  <h3>U-NEXT</h3>
  <p>
    U-NEXTは映画・ドラマ・アニメなど幅広いジャンルをチェックしやすい動画配信サービスです。
    作品数を重視したい方や、ほかの候補作品もあわせて探したい方に向いています。
  </p>
  ${affiliateLinks.unext ? renderWpButton(
    affiliateLinks.unext,
    "U-NEXT公式サイトを見る",
    "#e60023",
    "#ffffff"
  ) : ""}

  <h3>DMM TV</h3>
  <p>
    DMM TVはコストを意識しながら作品を探したい方に向いている動画配信サービスです。
    とくにアニメやエンタメ系の作品もあわせて楽しみたい方に向いています。
  </p>
  ${affiliateLinks.dmmtv ? renderWpButton(
    affiliateLinks.dmmtv,
    "DMM TV公式サイトを見る",
    "#ff6600",
    "#ffffff"
  ) : ""}

  <h3>Hulu</h3>
  <p>
    Huluはドラマ系作品を中心に探したい方にとって候補になりやすいサービスです。
    海外ドラマや国内ドラマをあわせて楽しみたい場合にも比較対象として見ておきたいところです。
  </p>
  ${affiliateLinks.hulu ? renderWpButton(
    affiliateLinks.hulu,
    "Hulu公式サイトを見る",
    "#1ce783",
    "#111111"
  ) : ""}

  <h3>Amazon Prime Video</h3>
  <p>
    Amazon Prime Videoは、まず幅広く作品検索をしてみたい方にとって使いやすい候補です。
    ほかの特典も含めてコスパを重視したい方にも向いています。
  </p>
  ${affiliateLinks.prime ? renderWpButton(
    affiliateLinks.prime,
    "Prime Videoはこちら",
    "#0073aa",
    "#ffffff"
  ) : ""}

  <h2>${safeTitle}の見どころ</h2>
  <ul>
    ${highlightsHtml}
  </ul>

  <h2>こんな人におすすめ</h2>
  <ul>
    ${recommendedHtml}
  </ul>

  <h2>${safeTitle}を探すときのチェックポイント</h2>
  <ol>
    <li>作品名で検索して、見放題・レンタル・購入の区分を確認する</li>
    <li>字幕・吹替・画質・対応端末の使いやすさを確認する</li>
    <li>月額料金や無料体験の条件を比較する</li>
    <li>シリーズ作品なら、関連作や続編も一緒に見られるか確認する</li>
  </ol>

  <h2>見逃し配信や無料視聴を探すときの注意点</h2>
  <p>
    「無料で見れる」「見逃し配信がある」と書かれていても、時期やキャンペーン条件によって対象外になることがあります。
    登録前に、対象作品かどうか、無料体験の対象条件、視聴期限の有無を確認しておくと安心です。
  </p>

  <h2>よくある質問</h2>

  <h3>Q. ${safeTitle}は無料で見れますか？</h3>
  <p>
    A. 無料体験があるサービスでも、対象外の場合があります。必ず公式で対象作品か確認してください。
  </p>

  <h3>Q. ${safeTitle}はどのサブスクで探せばいいですか？</h3>
  <p>
    A. まずは主要な動画配信サービスで作品名検索を行い、見放題・レンタル・購入の区分を比較するのがおすすめです。
  </p>

  <h3>Q. どの動画配信サービスを選べばいいですか？</h3>
  <p>
    A. 月額料金だけでなく、作品の取り扱い、無料体験、画質、同時視聴、ダウンロード対応などを総合的に比較するのがおすすめです。
  </p>

  <h2>どの動画配信サービスを選ぶか迷ったら</h2>
  <p>
    動画配信サービス選びで迷っている方は、主要サービスを比較したランキングページも参考にしてください。
  </p>
  <p>
    <a href="https://stream-press.com/vod-ranking/">おすすめ動画配信サービスランキングはこちら</a>
  </p>

  <h2>注意点</h2>
  <p>${safeCaution}</p>

  <hr />
  <p style="font-size:12px;opacity:.75;">
    ※当ページは配信可否を保証するものではありません。最新の配信状況は各サービスの公式情報をご確認ください。
  </p>
</div>
`.trim();
}

async function supabaseUpsert({ title, html, mediaType }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE env is not set");

  const slug = buildSlug({ title, mediaType });

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

module.exports = async (req, res) => {
  try {
    const guard = process.env.BATCH_GUARD_KEY || "";
    if (guard && req.query.key !== guard) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const title = (req.query.title || "").toString().trim();
    const mediaType = (req.query.mediaType || "").toString().trim().toLowerCase();

    if (!title) {
      return res.status(400).json({
        error: "missing_title",
        message: "title パラメータが必要です",
      });
    }

    const normalizedMediaType =
      mediaType === "movie" || mediaType === "tv" ? mediaType : "movie";

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
      title,
      mediaType: normalizedMediaType,
    };

    debug.step = "callOpenAI";
    const ai = await callOpenAI({
      title,
      mediaType: normalizedMediaType,
    });

    debug.step = "fetchTmdbPoster";
    const poster = await fetchTmdbPoster(title);

    const categories = detectCategories({
      title,
      mediaType: normalizedMediaType,
    });

    debug.step = "renderHtml";
    const html = renderHtml({ title, ai, poster });

    debug.step = "supabaseUpsert";
    const saved = await supabaseUpsert({
      title,
      html,
      mediaType: normalizedMediaType,
    });

    let wpResult = { skipped: true, reason: "duplicate_skip_wp" };


    if (saved.saved) {
      debug.step = "postToWordPress";
      wpResult = await postToWordPress({
        title: `${title}を見たい人向け｜配信サービスの探し方とおすすめVOD`,
        html,
        slug: saved.slug,
        poster,
        categories,
      });
    }

    const { postArticleToX } = require("../lib/xClient");

    let xResult = { skipped: true, reason: "wp_not_published" };

    if (wpResult?.ok && wpResult?.wpUrl) {
    xResult = await postArticleToX({
        title: `${title}を見たい人向け｜配信サービスの探し方とおすすめVOD`,
        url: wpResult.wpUrl,
        imageUrl: poster,
    });
}

    return res.status(200).json({
      ok: true,
      debug,
      result: {
        title,
        mediaType: normalizedMediaType,
        categories,
        ...saved,
        poster,
        wp: wpResult,
        x: xResult,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "generate_failed",
      message: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
};

