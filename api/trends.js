const Parser = require("rss-parser");
const parser = new Parser();

module.exports = async (req, res) => {
  try {
    const url =
      "https://trends.google.com/trends/trendingsearches/daily/rss?geo=JP&hl=ja&pn=p4";

    const feed = await parser.parseURL(url);

    const keywords = (feed.items || [])
      .map((item) => item.title)
      .filter(Boolean)
      .slice(0, 20);

    res.status(200).json({
      source: "google-trends-daily-rss",
      geo: "JP",
      count: keywords.length,
      keywords,
    });
  } catch (err) {
    res.status(500).json({
      error: "failed_to_fetch_trends",
      message: err?.message || String(err),
    });
  }
};
