module.exports = (req, res) => {
  const openai = process.env.OPENAI_API_KEY || "";
  const tmdb = process.env.TMDB_API_KEY || "";
  const test = process.env.TEST_VAR || "";
  res.status(200).json({
    openaiSet: Boolean(openai),
    openaiPrefix: openai.slice(0, 7),
    openaiLength: openai.length,
    tmdbSet: Boolean(tmdb),
    tmdbLength: tmdb.length,
    testVar: test,
  });
};