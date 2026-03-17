const X_POST_TEMPLATES = {
  question: ({ workTitle, url, hashtags }) => `\
${workTitle}ってどこで見れる？

主要VODを比較して
・料金
・無料体験
・特徴
をまとめました

気になる方はこちら👇
${url}

${hashtags}`,

  comparison: ({ workTitle, url, hashtags }) => `\
${workTitle}を見たい人へ

どの配信サービスを選べばいいか迷う方向けに
主要VODを比較してまとめました

料金や無料体験もチェックできます👇
${url}

${hashtags}`,

  freeTrial: ({ workTitle, url, hashtags }) => `\
${workTitle}をできるだけお得に見たい人へ

無料体験や料金も見ながら
探しやすいように整理しました

チェックはこちら👇
${url}

${hashtags}`,
};

module.exports = X_POST_TEMPLATES;