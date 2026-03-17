const { buildXPostText } = require("./xPostBuilder");

async function postArticleToX({ title, url, imageUrl = null }) {
  const postText = buildXPostText({ title, url });

  console.log("X POST TEXT:");
  console.log(postText);

  return {
    ok: true,
    text: postText,
    imageUrl,
  };
}

module.exports = {
  postArticleToX,
};