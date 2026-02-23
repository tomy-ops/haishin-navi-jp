// api/keywords.js
// TMDBで取得した「作品名」を、収益化しやすい検索キーワードに展開して返す

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

  return Array.from(new Set([...tvTitles, ...movieTitles])).slice(0, 20);
}

function expandKeywords(title) {
  const base = title.trim();

  // 1記事で答えるべき検索意図（作品ページの柱）
  return [
    `${base} 配信 どこで見れる`,
    `${base} 見逃し配信`,
    `${base} サブスク`,
    `${base} 無料`,
    `${base} 配信サービス 比較`,
  ];
}

module.exports = async (req, res) => {
  try {
    const titles = await fetchTmdbTitles();

    // 作品ごとに展開
    const perTitle = titles.map((t) => ({
      title: t,
      keywords: expandKeywords(t),
    }));

    // 全キーワードをフラットにした一覧も作る（後工程で便利）
    const all = Array.from(
      new Set(perTitle.flatMap((x) => x.keywords))
    );

    res.status(200).json({
      source: "tmdb_popular_jp",
      titleCount: titles.length,
      keywordCount: all.length,
      perTitle,
      all,
    });
  } catch (err) {
    res.status(500).json({
      error: "failed_to_generate_keywords",
      message: err?.message || String(err),
    });
  }
};