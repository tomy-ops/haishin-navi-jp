const Parser = require('rss-parser');
const parser = new Parser();

async function run() {
  try {
    // Googleニュース（日本・エンタメ）
    const url = 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSkwyMHZNRGx1YlY4U0FtdHZLQUFQAQ?hl=ja&gl=JP&ceid=JP:ja';
    const feed = await parser.parseURL(url);

    console.log("=== Google News（日本・エンタメ）上位20件 ===");
    feed.items.slice(0, 20).forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
    });

  } catch (err) {
    console.error("エラー発生");
    console.error(err.message || err);
  }
}

run();