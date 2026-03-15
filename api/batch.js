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
  return String(title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu,"-")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"")
}

function buildSlug({title,mediaType,tmdbId}){
  const base = slugifyJP(title) || "title"
  return `${base}-${mediaType}-${tmdbId}`
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
      style="background:${color};color:#fff;padding:14px 28px;border-radius:6px;font-weight:bold;text-decoration:none;display:inline-block;">
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

  <h1>${escapeHtml(title)}を見たい人向け｜配信サービスの探し方とおすすめVOD</h1>

  ${poster ? `<img src="${escapeHtml(poster)}" style="width:100%;max-width:420px;display:block;margin:auto;border-radius:10px;">` : ""}

  <p>
    ${escapeHtml(title)}を見たい人向けに、動画配信サービスの探し方とおすすめVODを紹介します。
  </p>

  <h2>${escapeHtml(title)}を視聴できる可能性がある動画配信サービス</h2>

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

function detectCategories({title,mediaType}){
  const categories = ["配信どこ"]

  if (mediaType === "movie") {
    categories.push("映画")
  }

  if (/アニメ|プリキュア|ガンダム|ポケモン|ドラゴンボール|ワンピース|名探偵コナン|呪術廻戦|鬼滅の刃|SPY×FAMILY|スパイファミリー|クレヨンしんちゃん|ちいかわ|ドラえもん|推しの子/i.test(title)) {
    categories.push("アニメ")
  } else if (mediaType === "tv") {
    categories.push("海外ドラマ")
  }

  return [...new Set(categories)]
}

async function postToWordPress({ title, html, slug, poster, categories }) {
  const url = (process.env.STREAMPRESS_PUBLISH_URL || "").trim()
  const key = (process.env.STREAMPRESS_PUBLISH_KEY || "").trim()

  if (!url || !key) {
    return {
      skipped: true,
      reason: "streampress_env_missing",
      url: !!url,
      key: !!key,
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-streampress-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      title,
      content: html,
      status: "draft",
      slug,
      featured_image_url: poster || null,
      categories: categories || [],
    }),
  })

  const text = await res.text()

  return {
    ok: res.ok,
    status: res.status,
    bodyHead: text.slice(0, 300),
  }
}

async function fetchTmdbTitles() {
  const key = process.env.TMDB_API_KEY
  if (!key) throw new Error("TMDB_API_KEY is not set")

  const tvUrl = `https://api.themoviedb.org/3/tv/popular?api_key=${key}&language=ja-JP&page=1&region=JP`
  const movieUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${key}&language=ja-JP&page=1&region=JP`

  const [tvRes, movieRes] = await Promise.all([fetch(tvUrl), fetch(movieUrl)])
  if (!tvRes.ok) throw new Error(`TMDB TV status ${tvRes.status}`)
  if (!movieRes.ok) throw new Error(`TMDB Movie status ${movieRes.status}`)

  const tvJson = await tvRes.json()
  const movieJson = await movieRes.json()

  const tvItems = (tvJson.results || [])
    .filter((x) => x && x.name)
    .map((x) => ({
      title: x.name,
      mediaType: "tv",
      tmdbId: x.id,
      posterPath: x.poster_path || null,
    }))

  const movieItems = (movieJson.results || [])
    .filter((x) => x && x.title)
    .map((x) => ({
      title: x.title,
      mediaType: "movie",
      tmdbId: x.id,
      posterPath: x.poster_path || null,
    }))

  const merged = [...tvItems, ...movieItems]

  const unique = []
  const seen = new Set()

  for (const item of merged) {
    const key = `${item.mediaType}:${item.tmdbId}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }

  return unique
    .filter(
      (x) =>
        x.title &&
        x.title.length < 80 &&
        !/news|live|tonight|late show|tagesschau/i.test(x.title)
    )
    .slice(0, 10)
}

async function fetchTmdbPoster(title) {
  const key = process.env.TMDB_API_KEY
  if (!key) return null

  const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(title)}&language=ja-JP`

  const r = await fetch(url)
  if (!r.ok) return null

  const j = await r.json()
  const poster = j.results?.[0]?.poster_path

  if (!poster) return null

  return `https://image.tmdb.org/t/p/w500${poster}`
}

async function supabaseUpsert({ title, html, mediaType, tmdbId }) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE env is not set")

  const slug = buildSlug({ title, mediaType, tmdbId })

  const r = await fetch(`${url}/rest/v1/articles`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ title, slug, html, source: "tmdb" }]),
  })

  if (r.ok) return { saved: true, slug }

  const t = await r.text()
  if (t.includes("duplicate key") || t.includes("articles_slug_key")) {
    return { saved: false, slug, reason: "duplicate" }
  }

  throw new Error(`Supabase error ${r.status}: ${t.slice(0, 300)}`)
}

module.exports = async (req, res) => {
  try {
    const guard = process.env.BATCH_GUARD_KEY || ""
    if (guard && req.query.key !== guard) {
      return res.status(401).json({ error: "unauthorized" })
    }

    const debug = {
      step: "start",
      env: {
        tmdb: !!process.env.TMDB_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        supabaseUrl: !!process.env.SUPABASE_URL,
        supabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        publishUrl: !!process.env.STREAMPRESS_PUBLISH_URL,
        publishKey: !!process.env.STREAMPRESS_PUBLISH_KEY,
      },
    }

    debug.step = "fetchTmdbTitles"
    const titles = await fetchTmdbTitles()
    debug.titlesCount = titles.length
    debug.firstTitle = titles[0]?.title || null

    const results = []

    for (const item of titles.slice(0, 3)) {
      const title = item.title
      const mediaType = item.mediaType
      const tmdbId = item.tmdbId

      debug.currentTitle = title

      let poster = item.posterPath
        ? `https://image.tmdb.org/t/p/w500${item.posterPath}`
        : null

      if (!poster) {
        debug.step = "fetchTmdbPoster"
        poster = await fetchTmdbPoster(title)
      }

      const categories = detectCategories({ title, mediaType })

      debug.step = "renderHtml"
      const html = renderHtml({ title, poster })

      debug.step = "supabaseUpsert"
      const saved = await supabaseUpsert({ title, html, mediaType, tmdbId })

      let wpResult = { skipped: true, reason: "duplicate_skip_wp" }

      if (saved.saved) {
        debug.step = "postToWordPress"
        wpResult = await postToWordPress({
          title: `${title}を見たい人向け｜配信サービスの探し方とおすすめVOD`,
          html,
          slug: saved.slug,
          poster,
          categories,
        })
      }

      results.push({
        title,
        mediaType,
        tmdbId,
        categories,
        ...saved,
        poster,
        wp: wpResult,
      })
    }

    return res.status(200).json({
      ok: true,
      debug,
      results,
    })
  } catch (err) {
    return res.status(500).json({
      error: "batch_failed",
      message: err?.message || String(err),
      stack: err?.stack || null,
    })
  }
}