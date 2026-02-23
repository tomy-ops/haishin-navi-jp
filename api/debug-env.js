module.exports = (req, res) => {
  const openai = process.env.OPENAI_API_KEY || "";
  const tmdb = process.env.TMDB_API_KEY || "";
  const test = process.env.TEST_VAR || "";
  const sUrl = process.env.SUPABASE_URL || "";
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  res.status(200).json({
    openaiSet: Boolean(openai),
    tmdbSet: Boolean(tmdb),
    testVar: test,
    supabaseUrlSet: Boolean(sUrl),
    supabaseUrlHost: sUrl ? new URL(sUrl).host : "",
    supabaseKeySet: Boolean(sKey),
    supabaseKeyPrefix: sKey.slice(0, 9), // "sb_secret" ならOK
  });
};