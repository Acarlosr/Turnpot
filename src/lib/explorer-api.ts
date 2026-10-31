/**
 * explorer-api.ts — fetches contract event logs from the Arc Blockscout-compatible
 * explorer API (?module=logs&action=getLogs).
 *
 * Response shape (per log entry):
 *   {
 *     blockNumber:      "0x…"   (hex)
 *     timeStamp:        "0x…"   (hex unix seconds)
 *     transactionHash:  "0x…"
 *     logIndex:         "0x…"   (hex)
 *     data:             "0x…"
 *     topics:           ["0x…", "0x…", null, null]  ← nulls must be stripped
 *   }
 *
 * Pagination: offset=1000 per page. If result.length === PAGE_SIZE, request page+1.
 * Throws on network error, CORS, or message !== "OK" so callers can fall back to RPC.
 */

// ── Explorer API base URLs ────────────────────────────────────────────────────

const EXPLORER_API: Record<number, string> = {
  5042:    'https://explorer.arc.io/api',
  5042002: 'https://explorer.testnet.arc.io/api',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawApiLog {
  blockNumber:     string          // hex
  timeStamp:       string          // hex unix seconds
  transactionHash: string
  logIndex:        string          // hex
  data:            string
  topics:          (string | null)[]
}

interface ApiResponse {
  message: string
  result:  RawApiLog[]
}

export interface ExplorerLog {
  blockNumber:     bigint
  timestamp:       number           // unix seconds
  transactionHash: `0x${string}`
  logIndex:        bigint
  data:            `0x${string}`
  /** Non-null topics only; safe to pass directly to viem decodeEventLog */
  topics:          [`0x${string}`, ...`0x${string}`[]]
}

// ── Converter ─────────────────────────────────────────────────────────────────

function parseHex(s: string): bigint {
  // Handle both "0x…" and plain decimal strings
  if (s.startsWith('0x') || s.startsWith('0X')) return BigInt(s)
  return BigInt(s)
}

function convertLog(raw: RawApiLog): ExplorerLog | null {
  // Strip null topics and ensure at least one topic (the event selector)
  const cleanTopics = raw.topics.filter((t): t is string => t !== null)
  if (cleanTopics.length === 0) return null

  return {
    blockNumber:     parseHex(raw.blockNumber),
    timestamp:       Number(parseHex(raw.timeStamp)),
    transactionHash: raw.transactionHash as `0x${string}`,
    logIndex:        parseHex(raw.logIndex),
    data:            (raw.data || '0x') as `0x${string}`,
    topics:          cleanTopics as [`0x${string}`, ...`0x${string}`[]],
  }
}

// ── Paginated fetch ───────────────────────────────────────────────────────────

const PAGE_SIZE = 1000

export async function fetchExplorerLogs(
  chainId: number,
  contractAddress: string,
  fromBlock: number | 'earliest' = 'earliest',
  toBlock: number | 'latest'    = 'latest',
): Promise<ExplorerLog[]> {
  const base = EXPLORER_API[chainId]
  if (!base) throw new Error(`No explorer API configured for chain ${chainId}`)

  const all: ExplorerLog[] = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      module:    'logs',
      action:    'getLogs',
      address:   contractAddress,
      fromBlock: String(fromBlock),
      toBlock:   String(toBlock),
      page:      String(page),
      offset:    String(PAGE_SIZE),
    })

    const url = `${base}?${params.toString()}`
    // Use a 10s timeout — CORS failures or Cloudflare challenges surface quickly
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    let resp: Response
    try {
      resp = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }

    if (!resp.ok) throw new Error(`Explorer API HTTP ${resp.status}`)

    const json = (await resp.json()) as ApiResponse

    if (json.message !== 'OK') {
      // "No records found" is a valid empty result, not an error
      if (json.message === 'No records found' || (Array.isArray(json.result) && json.result.length === 0)) {
        break
      }
      throw new Error(`Explorer API error: ${json.message}`)
    }

    for (const raw of json.result) {
      const log = convertLog(raw)
      if (log) all.push(log)
    }

    // If we got a full page there may be more; request the next page
    if (json.result.length < PAGE_SIZE) break
    page++
  }

  return all
}
