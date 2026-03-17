// api/article.js
// 固定テンプレ + 一部だけAIで埋める「作品ページ」生成

async function callOpenAI({ title }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  // AIが書くのは短いパーツだけ（暴走防止）
  const prompt = `
あなたは日本の配信情報メディア編集者です。
次の作品について、配信先を断定せずに、作品紹介として使える文章パーツだけを日本語で作ってください。
【重要ルール】
- 配信サービス名を断定で書かない（「〜で配信中」と言い切らない）
- 事実不明なことは推測しない（放送年・キャスト等も断定しない）
- 作品の魅力が伝わる一般的な紹介にする
- 出力は必ずJSONのみ

作品名: ${title}

出力JSONの形式:
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
      // JSONだけ返させる
      text: { format: { type: "json_object" } },
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${t.slice(0, 300)}`);
  }

  const data = await r.json();
  // Responses API は output_text が取りやすい
  const jsonText = data.output?.[0]?.content?.[0]?.text || data.output_text;
  return JSON.parse(jsonText);
}

function renderHtml({ title, ai }) {
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
      配信作品や無料体験の条件は変更されることがあります。
      最新の配信状況は、各動画配信サービスの公式ページで確認するのが確実です。
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

module.exports = async (req, res) => {
  try {
    const title = String(req.query.title || "").trim();
    if (!title) {
      return res.status(400).json({ error: "missing_title", message: "title is required" });
    }

    const ai = await callOpenAI({ title });
    const html = renderHtml({ title, ai });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).json({
      error: "failed_to_generate_article",
      message: err?.message || String(err),
    });
  }
};