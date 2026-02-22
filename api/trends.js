module.exports = async (req, res) => {
  try {
    const key = process.env.TMDB_API_KEY;
    if (!key) {
      return res.status(500).json({
        error: "missing_env",
        message: "TMDB_API_KEY is not set in Vercel Environment Variables.",
      });
    }

    const tvUrl = `https://api.themoviedb.org/3/tv/popular?api_key=${key}&language=ja-JP&page=1&region=JP`;
    const movieUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${key}&language=ja-JP&page=1&region=JP`;

    const [tvRes, movieRes] = await Promise.all([fetch(tvUrl), fetch(movieUrl)]);

    if (!tvRes.ok) throw new Error(`TMDB TV status ${tvRes.status}`);
    if (!movieRes.ok) throw new Error(`TMDB Movie status ${movieRes.status}`);

    const tvJson = await tvRes.json();
    const movieJson = await movieRes.json();

    const tvTitles = (tvJson.results || []).map((x) => x.name).filter(Boolean);
    const movieTitles = (movieJson.results || []).map((x) => x.title).filter(Boolean);

    const keywords = Array.from(new Set([...tvTitles, ...movieTitles])).slice(0, 20);

    return res.status(200).json({
      source: "tmdb_popular_jp",
      count: keywords.length,
      keywords,
    });
  } catch (err) {
    return res.status(500).json({
      error: "failed_to_fetch_trends",
      message: err?.message || String(err),
    });
  }
};