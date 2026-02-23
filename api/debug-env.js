module.exports = (req, res) => {
  const openai = process.env.OPENAI_API_KEY || "";
  const tmdb = process.env.TMDB_API_KEY || "";
  res.status(200).json({
    openaiSet: Boolean(openai),
    openaiPrefix: openai.slice(0, 7), // "sk-proj" などが見えればOK
    openaiLength: openai.length,
    tmdbSet: Boolean(tmdb),
    tmdbLength: tmdb.length,
  });
};