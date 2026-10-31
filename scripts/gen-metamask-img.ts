/**
 * Generates a MetaMask home screen mockup PNG.
 * Run with: bun scripts/gen-metamask-img.ts
 */
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('public/images', { recursive: true })

const W = 390
const H = 520

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Status bar -->
  <rect width="${W}" height="44" fill="rgba(0,0,0,0.3)"/>
  <text x="20" y="28" font-family="system-ui,sans-serif" font-size="13" fill="#9ca3af">9:41</text>
  <text x="${W - 20}" y="28" font-family="system-ui,sans-serif" font-size="13" fill="#9ca3af" text-anchor="end">100%</text>

  <!-- MetaMask header bar -->
  <rect y="44" width="${W}" height="56" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  <!-- Fox logo placeholder circle -->
  <circle cx="32" cy="72" r="16" fill="#f6851b" opacity="0.9"/>
  <text x="32" y="77" font-family="system-ui,sans-serif" font-size="13" fill="white" text-anchor="middle" font-weight="bold">🦊</text>
  <!-- Network pill -->
  <rect x="${W/2 - 52}" y="60" width="104" height="24" rx="12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <text x="${W/2}" y="76" font-family="system-ui,sans-serif" font-size="12" fill="#d1d5db" text-anchor="middle">Ethereum Mainnet ▾</text>
  <!-- Identicon -->
  <circle cx="${W - 32}" cy="72" r="16" fill="#4f46e5"/>
  <text x="${W - 32}" y="77" font-family="system-ui,sans-serif" font-size="10" fill="white" text-anchor="middle">0x...</text>

  <!-- Account address pill -->
  <rect x="${W/2 - 60}" y="116" width="120" height="28" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  <text x="${W/2}" y="134" font-family="system-ui,sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">0x71C7...976F ⎘</text>

  <!-- ETH Balance -->
  <text x="${W/2}" y="184" font-family="system-ui,sans-serif" font-size="36" fill="white" text-anchor="middle" font-weight="700">$0.00</text>
  <text x="${W/2}" y="210" font-family="system-ui,sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">0 ETH</text>

  <!-- Action buttons row -->
  <g transform="translate(${W/2 - 120}, 232)">
    <!-- Buy -->
    <circle cx="30" cy="24" r="24" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" stroke-width="1.5"/>
    <text x="30" y="29" font-family="system-ui,sans-serif" font-size="14" fill="#818cf8" text-anchor="middle">↓</text>
    <text x="30" y="68" font-family="system-ui,sans-serif" font-size="11" fill="#9ca3af" text-anchor="middle">Buy</text>
    <!-- Send -->
    <circle cx="110" cy="24" r="24" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" stroke-width="1.5"/>
    <text x="110" y="29" font-family="system-ui,sans-serif" font-size="14" fill="#818cf8" text-anchor="middle">↑</text>
    <text x="110" y="68" font-family="system-ui,sans-serif" font-size="11" fill="#9ca3af" text-anchor="middle">Send</text>
    <!-- Swap -->
    <circle cx="190" cy="24" r="24" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" stroke-width="1.5"/>
    <text x="190" y="29" font-family="system-ui,sans-serif" font-size="14" fill="#818cf8" text-anchor="middle">⇄</text>
    <text x="190" y="68" font-family="system-ui,sans-serif" font-size="11" fill="#9ca3af" text-anchor="middle">Swap</text>
    <!-- Bridge -->
    <circle cx="270" cy="24" r="24" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" stroke-width="1.5"/>
    <text x="270" y="29" font-family="system-ui,sans-serif" font-size="14" fill="#818cf8" text-anchor="middle">⚡</text>
    <text x="270" y="68" font-family="system-ui,sans-serif" font-size="11" fill="#9ca3af" text-anchor="middle">Bridge</text>
  </g>

  <!-- Tokens section -->
  <rect x="16" y="328" width="${W - 32}" height="44" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  <circle cx="44" cy="350" r="14" fill="#627eea"/>
  <text x="44" y="355" font-family="system-ui,sans-serif" font-size="11" fill="white" text-anchor="middle" font-weight="bold">Ξ</text>
  <text x="68" y="345" font-family="system-ui,sans-serif" font-size="13" fill="white" font-weight="600">Ethereum</text>
  <text x="68" y="362" font-family="system-ui,sans-serif" font-size="11" fill="#6b7280">0 ETH</text>
  <text x="${W - 32}" y="355" font-family="system-ui,sans-serif" font-size="13" fill="#9ca3af" text-anchor="end">$0.00</text>

  <!-- "Create a new wallet" CTA button -->
  <rect x="16" y="400" width="${W - 32}" height="52" rx="14" fill="#2775CA"/>
  <text x="${W/2}" y="431" font-family="system-ui,sans-serif" font-size="16" fill="white" text-anchor="middle" font-weight="700">Create a new wallet</text>

  <!-- Import wallet link -->
  <text x="${W/2}" y="478" font-family="system-ui,sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">Import existing wallet</text>

  <!-- Caption overlay -->
  <rect x="0" y="${H - 36}" width="${W}" height="36" fill="rgba(0,0,0,0.6)"/>
  <text x="${W/2}" y="${H - 14}" font-family="system-ui,sans-serif" font-size="11" fill="#9ca3af" text-anchor="middle">MetaMask — tap "Create a new wallet" to get started</text>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng()
writeFileSync('public/images/metamask-home.png', png)
console.log(`Generated public/images/metamask-home.png (${png.length} bytes)`)
