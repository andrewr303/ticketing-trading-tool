import { supabase } from './supabase'
import type { Position, Trade, WatchlistEvent, BriefData, DeepResearchResult } from './types'

// ============================================
// POSITIONS
// ============================================

export async function getPositions(): Promise<Position[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .order('event_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    eventName: row.event_name,
    artistOrTeam: row.artist_or_team,
    venue: row.venue,
    eventDate: row.event_date,
    section: row.section,
    quantity: row.quantity,
    costPerTicket: Number(row.cost_per_ticket),
    currentMarketPrice: Number(row.current_market_price),
    category: row.category as Position['category'],
    purchaseDate: row.purchase_date,
    priceTrend: row.price_trend as Position['priceTrend'],
  }))
}

export async function upsertPosition(p: Omit<Position, 'id'> & { id?: string }) {
  const { error } = await supabase.from('positions').upsert({
    ...(p.id ? { id: p.id } : {}),
    event_name: p.eventName,
    artist_or_team: p.artistOrTeam,
    venue: p.venue,
    event_date: p.eventDate,
    section: p.section,
    quantity: p.quantity,
    cost_per_ticket: p.costPerTicket,
    current_market_price: p.currentMarketPrice,
    category: p.category,
    purchase_date: p.purchaseDate,
    price_trend: p.priceTrend,
  })
  if (error) throw error
}

export async function deletePosition(id: string) {
  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// TRADES
// ============================================

export async function getTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('sell_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    eventName: row.event_name,
    category: row.category as Trade['category'],
    venue: row.venue,
    buyDate: row.buy_date,
    sellDate: row.sell_date,
    section: row.section,
    quantity: row.quantity,
    costPerTicket: Number(row.cost_per_ticket),
    salePrice: Number(row.sale_price),
    platformSold: row.platform_sold as Trade['platformSold'],
    feesPaid: Number(row.fees_paid),
    notes: row.notes ?? '',
  }))
}

export async function insertTrade(t: Omit<Trade, 'id'>) {
  const { error } = await supabase.from('trades').insert({
    event_name: t.eventName,
    category: t.category,
    venue: t.venue,
    buy_date: t.buyDate,
    sell_date: t.sellDate,
    section: t.section,
    quantity: t.quantity,
    cost_per_ticket: t.costPerTicket,
    sale_price: t.salePrice,
    platform_sold: t.platformSold,
    fees_paid: t.feesPaid,
    notes: t.notes,
  })
  if (error) throw error
}

export async function deleteTrade(id: string) {
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// WATCHLIST
// ============================================

export async function getWatchlist(): Promise<WatchlistEvent[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('event_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    category: row.category as WatchlistEvent['category'],
    eventDate: row.event_date,
    venue: row.venue,
    demandScore: row.demand_score ?? undefined,
    trend: (row.trend as WatchlistEvent['trend']) ?? undefined,
    lastAnalyzed: row.last_analyzed ?? undefined,
  }))
}

export async function upsertWatchlistItem(w: Omit<WatchlistEvent, 'id'> & { id?: string }) {
  const { error } = await supabase.from('watchlist').upsert({
    ...(w.id ? { id: w.id } : {}),
    name: w.name,
    category: w.category,
    event_date: w.eventDate,
    venue: w.venue,
    demand_score: w.demandScore ?? null,
    trend: w.trend ?? null,
    last_analyzed: w.lastAnalyzed ?? null,
  })
  if (error) throw error
}

export async function deleteWatchlistItem(id: string) {
  const { error } = await supabase.from('watchlist').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// BRIEFS
// ============================================

export async function getTodayBrief(): Promise<BriefData | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('briefs')
    .select('data')
    .eq('brief_date', today)
    .maybeSingle()
  if (error) throw error
  return data?.data as BriefData | null
}

export async function saveBrief(briefData: BriefData) {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('briefs').upsert({
    brief_date: today,
    data: briefData as unknown as Record<string, unknown>,
  }, { onConflict: 'user_id,brief_date' })
  if (error) throw error
}

// ============================================
// DEEP RESEARCH CACHE
// ============================================

export async function getCachedResearch(params: {
  regions: string[]
  categories: string[]
  dateRange: string
}): Promise<DeepResearchResult | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('deep_research_cache')
    .select('data')
    .eq('research_date', today)
    .contains('regions', params.regions)
    .contains('categories', params.categories.length > 0 ? params.categories : ['concert', 'sports', 'theater', 'comedy', 'festival'])
    .eq('date_range', params.dateRange)
    .maybeSingle()
  if (error) throw error
  return data?.data as DeepResearchResult | null
}

export async function saveResearchCache(
  result: DeepResearchResult,
  params: { regions: string[]; categories: string[]; dateRange: string },
  metadata?: Record<string, unknown>
) {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('deep_research_cache').upsert({
    research_date: today,
    regions: params.regions,
    categories: params.categories.length > 0 ? params.categories : ['concert', 'sports', 'theater', 'comedy', 'festival'],
    date_range: params.dateRange,
    data: result as unknown as Record<string, unknown>,
    metadata: metadata as unknown as Record<string, unknown> ?? null,
  }, { onConflict: 'user_id,research_date,regions,categories,date_range' })
  if (error) throw error
}
