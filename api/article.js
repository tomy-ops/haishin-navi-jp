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
  // 固定テンプレ（ここがブレない骨格）
  const h = `
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}はどこで見れる？配信サービス比較と無料視聴の考え方</title>
</head>
<body>
  <main style="max-width:760px;margin:24px auto;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <h1>『${title}』はどこで見れる？配信サービス比較と無料視聴の考え方</h1>

    <p>${ai.lead}</p>

    <h2>まず結論：配信状況は公式で確認するのが確実</h2>
    <ul>
      <li>配信ラインナップは変わるため、各サービスの公式検索で確認する</li>
      <li>無料体験の有無や条件も、公式の最新情報を確認する</li>
    </ul>

    <h2>『${title}』の見どころ</h2>
    <ul>
      ${ai.highlights.map(x => `<li>${x}</li>`).join("")}
    </ul>

    <h2>こんな人におすすめ</h2>
    <ul>
      ${ai.recommendedFor.map(x => `<li>${x}</li>`).join("")}
    </ul>

    <h2>配信サービスを選ぶポイント（固定テンプレ）</h2>
    <ol>
      <li>見たい作品が多いか（同ジャンル・関連作が揃うか）</li>
      <li>月額料金と無料体験の条件</li>
      <li>画質・同時視聴・ダウンロードの可否</li>
      <li>字幕/吹替や視聴デバイス対応</li>
    </ol>

    <h2>よくある質問（FAQ）</h2>
    <h3>Q. 『${title}』は無料で見れますか？</h3>
    <p>A. 無料体験があるサービスでも対象外の場合があります。必ず公式で対象作品か確認してください。</p>

    <h3>Q. どのサブスクを選べばいい？</h3>
    <p>A. まず「見たい作品が揃うか」を優先し、次に料金・画質・同時視聴などで比較するのがおすすめです。</p>

    <h2>注意点</h2>
    <p>${ai.caution}</p>

    <hr />
    <p style="font-size:12px;opacity:.75;">
      ※当ページは作品の配信可否を保証するものではありません。最新の配信状況は各サービスの公式情報をご確認ください。
    </p>
  </main>
</body>
</html>
`.trim();

  return h;
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