const {
  buildSlug,
  callOpenAIJson,
  ensureAuthorized,
  fetchTmdbPoster,
  nl2brSafe,
  normalizeArray,
  publishFlow,
  renderCommonAffiliateBlock,
  renderServiceTable,
  escapeHtml,
} = require("../lib/articleCommon");

function renderVodFullHtml({ title, ai, poster }) {
  const safeTitle = escapeHtml(title);
  const highlights = normalizeArray(ai.highlights).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  const recommended = normalizeArray(ai.recommendedFor).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  const faq = Array.isArray(ai.faq) ? ai.faq : [];

  return `
<div style="max-width:760px;margin:24px auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.9;padding:0 16px;">
  ${poster ? `<img src="${escapeHtml(poster)}" alt="${safeTitle}" style="width:100%;max-width:420px;display:block;margin:0 auto 24px;border-radius:12px;">` : ""}
  <h1>${safeTitle}はどこで見れる？配信サービスの探し方とおすすめVOD</h1>

  <p>${nl2brSafe(ai.lead || "")}</p>

  <h2>結論：${safeTitle}はどこで探すべき？</h2>
  <p>
    ${safeTitle}を見たいときは、主要な動画配信サービスで作品名検索を行い、
    見放題・レンタル・購入の区分を確認するのが基本です。
    配信状況は変動するため、登録前に各サービスの公式サイトをチェックしておくと安心です。
  </p>

  <h2>${safeTitle}を探すときに候補になりやすい動画配信サービス</h2>
  <p>映画・ドラマ・アニメを広く扱う主要サービスを比較すると、見つけやすくなります。</p>
  ${renderServiceTable()}

  <h2>${safeTitle}を無料で見たい場合の考え方</h2>
  <p>
    無料体験があるサービスやキャンペーンを活用する方法がありますが、
    対象作品や条件は変わることがあります。利用前に必ず公式情報をご確認ください。
  </p>
  <ul>
    <li>無料体験の有無を確認する</li>
    <li>見放題対象かレンタル対象かを確認する</li>
    <li>視聴期限やキャンペーン条件も確認する</li>
  </ul>

  ${renderCommonAffiliateBlock()}

  <h2>${safeTitle}の見どころ</h2>
  <ul>${highlights}</ul>

  <h2>こんな人におすすめ</h2>
  <ul>${recommended}</ul>

  <h2>${safeTitle}を探すときのチェックポイント</h2>
  <ol>
    <li>作品名で検索し、見放題・レンタル・購入の区分を確認する</li>
    <li>字幕・吹替・画質・対応端末を確認する</li>
    <li>月額料金や無料体験の条件を比較する</li>
    <li>シリーズ作品なら関連作も見られるか確認する</li>
  </ol>

  <h2>よくある質問</h2>
  ${faq.map((x) => `
    <h3>Q. ${escapeHtml(x.q || "")}</h3>
    <p>A. ${nl2brSafe(x.a || "")}</p>
  `).join("")}

  <h2>注意点</h2>
  <p>${nl2brSafe(ai.caution || "")}</p>

  <p>
    関連して、<a href="https://stream-press.com/vod-ranking/">おすすめ動画配信サービスランキング</a>も参考にしてみてください。
  </p>

  <hr />
  <p style="font-size:12px;opacity:.75;">
    ※当ページは配信可否を保証するものではありません。最新の配信状況は各サービスの公式情報をご確認ください。
  </p>
</div>
`.trim();
}

async function buildVodFullAi({ title, mediaType }) {
  return callOpenAIJson(`
あなたは日本のVODメディア編集者です。
次の作品について、SEO向けの網羅型記事に使うJSONを作ってください。

ルール:
- 配信先を断定しない
- 年・キャスト・制作会社など不確かな事実を断定しない
- 見どころは一般的な魅力の言語化にとどめる
- 公式確認が必要という前提で書く
- 出力はJSONのみ
- lead: 180〜320字
- highlights: 4〜5個
- recommendedFor: 4〜5個
- faq: 3個
- caution: 80〜160字

作品名: ${title}
メディア種別: ${mediaType}

JSON:
{
  "lead": "導入文",
  "highlights": ["見どころ1","見どころ2","見どころ3","見どころ4"],
  "recommendedFor": ["おすすめ1","おすすめ2","おすすめ3","おすすめ4"],
  "faq": [
    {"q":"質問1","a":"回答1"},
    {"q":"質問2","a":"回答2"},
    {"q":"質問3","a":"回答3"}
  ],
  "caution": "注意点"
}
`.trim());
}

module.exports = async (req, res) => {
  if (!ensureAuthorized(req, res)) return;

  try {
    const title = String(req.query.title || "").trim();
    const mediaType = String(req.query.mediaType || "movie").trim().toLowerCase() === "tv" ? "tv" : "movie";

    if (!title) {
      return res.status(400).json({ error: "missing_title", message: "title が必要です" });
    }

    const ai = await buildVodFullAi({ title, mediaType });
    const poster = await fetchTmdbPoster(title);

    const wpTitle = `${title}はどこで見れる？配信サービスの探し方とおすすめVOD`;
    const slug = buildSlug(wpTitle, "vod-full");
    const html = renderVodFullHtml({ title, ai, poster });

    const result = await publishFlow({
      wpTitle,
      slug,
      html,
      poster,
      categories: ["配信どこ"],
      source: "manual_vod_full",
    });

    return res.status(200).json({
      ok: true,
      result: {
        title: wpTitle,
        slug,
        poster,
        ...result,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "generate_vod_full_failed",
      message: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
};