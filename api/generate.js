const affiliateLinks = require("../lib/affiliateLinks")

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;")
}

function slugifyJP(title){
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu,"-")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"")
}

function buildSlug({title,mediaType}){
  const base = slugifyJP(title)
  return `${base}-${mediaType}`
}

function renderWpButton(url,label,color="#e60023"){
  if(!url) return ""

  return `
<div class="wp-block-buttons is-layout-flex" style="justify-content:center;margin:20px 0;">
<div class="wp-block-button">
<a class="wp-block-button__link wp-element-button"
href="${escapeHtml(url)}"
target="_blank"
rel="nofollow sponsored noopener"
style="background:${color};color:#fff;padding:14px 28px;border-radius:6px;font-weight:bold;text-decoration:none;">
${escapeHtml(label)}
</a>
</div>
</div>
`
}

function renderServiceTable(){
return `
<table style="width:100%;border-collapse:collapse;text-align:center;margin:16px 0;">
<tr>
<th style="border:1px solid #ddd;padding:10px;">サービス</th>
<th style="border:1px solid #ddd;padding:10px;">月額料金</th>
<th style="border:1px solid #ddd;padding:10px;">無料体験</th>
</tr>

<tr>
<td style="border:1px solid #ddd;padding:10px;">U-NEXT</td>
<td style="border:1px solid #ddd;padding:10px;">2189円</td>
<td style="border:1px solid #ddd;padding:10px;">31日</td>
</tr>

<tr>
<td style="border:1px solid #ddd;padding:10px;">DMM TV</td>
<td style="border:1px solid #ddd;padding:10px;">550円</td>
<td style="border:1px solid #ddd;padding:10px;">30日</td>
</tr>

<tr>
<td style="border:1px solid #ddd;padding:10px;">Hulu</td>
<td style="border:1px solid #ddd;padding:10px;">1026円</td>
<td style="border:1px solid #ddd;padding:10px;">なし</td>
</tr>

<tr>
<td style="border:1px solid #ddd;padding:10px;">Amazon Prime Video</td>
<td style="border:1px solid #ddd;padding:10px;">600円</td>
<td style="border:1px solid #ddd;padding:10px;">30日</td>
</tr>

<tr>
<td style="border:1px solid #ddd;padding:10px;">ABEMA</td>
<td style="border:1px solid #ddd;padding:10px;">プランによる</td>
<td style="border:1px solid #ddd;padding:10px;">なし</td>
</tr>

<tr>
<td style="border:1px solid #ddd;padding:10px;">DAZN</td>
<td style="border:1px solid #ddd;padding:10px;">プランによる</td>
<td style="border:1px solid #ddd;padding:10px;">なし</td>
</tr>
</table>

<p style="font-size:13px;color:#666;">
※料金や無料体験は変更される可能性があります。最新情報は公式サイトをご確認ください。
</p>
`
}

function renderHtml({title,poster}){

return `
<div style="max-width:760px;margin:auto;line-height:1.9">

<h1>${title}を見たい人向け｜配信サービスの探し方とおすすめVOD</h1>

${poster ? `<img src="${poster}" style="width:100%;max-width:420px;display:block;margin:auto;border-radius:10px;">`:""}

<p>
${title}を見たい人向けに、動画配信サービスの探し方とおすすめVODを紹介します。
</p>

<h2>${title}を視聴できる可能性がある動画配信サービス</h2>

${renderServiceTable()}

<h2>おすすめの動画配信サービス</h2>

<h3>U-NEXT</h3>
<p>映画・ドラマ・アニメまで幅広く作品を探しやすい動画配信サービスです。</p>
${renderWpButton(affiliateLinks.unext,"U-NEXT公式サイトを見る","#e60023")}

<h3>DMM TV</h3>
<p>コスパ重視で動画配信を楽しみたい方に向いています。</p>
${renderWpButton(affiliateLinks.dmmtv,"DMM TV公式サイトを見る","#ff6600")}

<h3>Hulu</h3>
<p>ドラマ作品を中心に探したい人におすすめのサービスです。</p>
${renderWpButton(affiliateLinks.hulu,"Hulu公式サイトを見る","#1ce783")}

<h3>Amazon Prime Video</h3>
<p>コスパ重視の動画配信サービスとして人気があります。</p>
${renderWpButton(affiliateLinks.prime,"Prime Videoはこちら","#0073aa")}

</div>
`
}

async function fetchTmdbPoster(title){
const key = process.env.TMDB_API_KEY
if(!key) return null

const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(title)}&language=ja-JP`

const r = await fetch(url)
const j = await r.json()

const poster = j.results?.[0]?.poster_path
if(!poster) return null

return `https://image.tmdb.org/t/p/w500${poster}`
}

module.exports = async (req,res)=>{

try{

const title = req.query.title
const mediaType = req.query.mediaType || "tv"

if(!title){
return res.status(400).json({error:"title required"})
}

const poster = await fetchTmdbPoster(title)

const html = renderHtml({
title,
poster
})

const slug = buildSlug({title,mediaType})

return res.json({
ok:true,
title,
slug,
poster,
html
})

}catch(e){

return res.status(500).json({
error:e.message
})

}

}