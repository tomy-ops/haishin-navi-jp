const X_POST_TEMPLATES = require("./xPostTemplates");

function extractWorkTitle(title = "") {
  return String(title)
    .replace(/を見たい人向け.*$/, "")
    .replace(/\|.*$/, "")
    .replace(/｜.*$/, "")
    .trim();
}

function buildHashtags(workTitle = "") {
  const safeTitle = workTitle.replace(/\s+/g, "");
  return `#${safeTitle} #VOD`;
}

function pickTemplateKey(title = "") {
  const keys = ["question", "comparison", "freeTrial"];

  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash += title.charCodeAt(i);
  }

  return keys[hash % keys.length];
}

function buildXPostText({ title, url }) {
  const workTitle = extractWorkTitle(title);
  const hashtags = buildHashtags(workTitle);
  const templateKey = pickTemplateKey(title);
  const template = X_POST_TEMPLATES[templateKey];

  return template({
    workTitle,
    url,
    hashtags,
  });
}

module.exports = {
  extractWorkTitle,
  buildHashtags,
  pickTemplateKey,
  buildXPostText,
};