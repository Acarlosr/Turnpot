/**
 * Generates public/favicon-32.png, public/apple-touch-icon.png (180×180),
 * public/icon-192.png, public/icon-512.png and public/og.png
 * from the favicon SVG and an inline OG SVG template.
 *
 * Run: bun scripts/gen-icons.ts
 */

import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── favicon SVG ──────────────────────────────────────────────────────────────
const faviconSvg = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8')

function renderSvgToPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  })
  return Buffer.from(resvg.render().asPng())
}

// favicon-32.png
writeFileSync(
  resolve(root, 'public/favicon-32.png'),
  renderSvgToPng(faviconSvg, 32),
)
console.log('✓ favicon-32.png')

// apple-touch-icon.png (180×180)
writeFileSync(
  resolve(root, 'public/apple-touch-icon.png'),
  renderSvgToPng(faviconSvg, 180),
)
console.log('✓ apple-touch-icon.png')

// icon-192.png (manifest)
writeFileSync(
  resolve(root, 'public/icon-192.png'),
  renderSvgToPng(faviconSvg, 192),
)
console.log('✓ icon-192.png')

// icon-512.png (manifest)
writeFileSync(
  resolve(root, 'public/icon-512.png'),
  renderSvgToPng(faviconSvg, 512),
)
console.log('✓ icon-512.png')

// ── OG image SVG template (1200×630) ────────────────────────────────────────
// Large logo (centered left), wordmark + tagline (right area)
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1120"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2775CA" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#2775CA" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle left glow -->
  <ellipse cx="320" cy="315" rx="280" ry="280" fill="#2775CA" opacity="0.06"/>

  <!-- Brand bar (top) -->
  <rect x="0" y="0" width="1200" height="4" fill="#2775CA" opacity="0.7"/>

  <!-- Large logo mark (centred at 320,315, scaled 12×) -->
  <!-- Background circle -->
  <circle cx="320" cy="315" r="155" fill="#0f172a" stroke="#1e3a5f" stroke-width="2"/>

  <!-- Dashed connector ring -->
  <circle cx="320" cy="315" r="90" fill="none" stroke="#334155" stroke-width="2.5" stroke-dasharray="8 8"/>

  <!-- Inactive member dots -->
  <circle cx="410" cy="315" r="22" fill="#64748b"/>
  <circle cx="320" cy="405" r="22" fill="#64748b"/>
  <circle cx="230" cy="315" r="22" fill="#64748b"/>

  <!-- Highlighted member (top) -->
  <circle cx="320" cy="225" r="38" fill="#2775CA" opacity="0.18"/>
  <circle cx="320" cy="225" r="27" fill="#2775CA"/>

  <!-- Central coin -->
  <circle cx="320" cy="315" r="52" fill="#2775CA"/>
  <circle cx="320" cy="315" r="52" fill="none" stroke="#1a5fa8" stroke-width="3"/>
  <text x="320" y="336" text-anchor="middle"
        font-family="'Arial Black',Arial,sans-serif"
        font-size="52" font-weight="800" fill="#ffffff">$</text>

  <!-- Right side: wordmark + taglines -->
  <!-- "TurnPot" -->
  <text x="600" y="270" font-family="'DM Sans','Arial',sans-serif"
        font-size="92" font-weight="700" fill="#f8fafc" letter-spacing="-2">TurnPot</text>

  <!-- Divider -->
  <rect x="600" y="295" width="60" height="3" rx="2" fill="#2775CA"/>

  <!-- Primary tagline -->
  <text x="600" y="355" font-family="'DM Sans','Arial',sans-serif"
        font-size="36" font-weight="500" fill="#cbd5e1">Save together. Take turns.</text>

  <!-- Sub tagline -->
  <text x="600" y="415" font-family="'DM Sans','Arial',sans-serif"
        font-size="26" font-weight="400" fill="#64748b">Rotating savings circles in USDC on Arc</text>

  <!-- Bottom badge -->
  <rect x="600" y="500" width="220" height="42" rx="21" fill="#2775CA" opacity="0.15" stroke="#2775CA" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="710" y="526" text-anchor="middle" font-family="'DM Sans','Arial',sans-serif"
        font-size="20" font-weight="600" fill="#2775CA">turnpot.vercel.app</text>
</svg>`

writeFileSync(resolve(root, 'public/og.png'), renderSvgToPng(ogSvg, 1200))
console.log('✓ og.png')

console.log('\nAll icons generated.')
