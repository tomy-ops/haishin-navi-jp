const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildPostPatterns(title, url) {
  return [
    `${title}ってどこで見れる？

無料で見れる？
サブスクどれがいい？

迷ってる人向けに
配信サービスまとめました👇

${url}

#VOD`,

    `${title}見るならどれ？

・U-NEXT
・DMM TV
・Hulu
・Prime Video

料金・無料体験を比較👇

${url}

#サブスク比較`,

    `${title}
無料で見れる方法ある？

実はサブスクの無料体験を使えば
見れる可能性あり👇

${url}

#無料視聴`
  ];
}

async function enqueueXPosts({ title, slug, url, imageUrl }) {
  try {
    const posts = buildPostPatterns(title, url);

    const now = new Date();

    const rows = posts.map((text, i) => {
      const scheduled = new Date(now.getTime() + i * 60 * 60 * 1000); // 1時間ずつ

      return {
        article_slug: slug,
        article_title: title,
        article_url: url,
        post_text: text,
        image_url: imageUrl,
        scheduled_for: scheduled.toISOString(),
        status: "queued",
      };
    });

    const { data, error } = await supabase
      .from("x_post_queue")
      .insert(rows)
      .select();

    if (error) throw error;

    return {
      ok: true,
      count: data.length,
      rows: data,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
    };
  }
}

module.exports = { enqueueXPosts };