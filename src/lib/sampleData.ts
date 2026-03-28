import type { BriefData, Position, Trade, WatchlistEvent } from './types';

export const SAMPLE_BRIEF: BriefData = {
  market_summary: "Secondary market activity surged overnight driven by strong NBA playoff positioning and summer concert announcements. Denver market particularly active with Nuggets and Avalanche both in playoff contention. Concert inventory tightening as Red Rocks and Ball Arena summer calendars fill out.",
  priority_events: [
    {
      event_name: "Nuggets vs Lakers — Rd 1 Game 3",
      event_date: "Apr 22, 2026",
      venue: "Ball Arena, Denver",
      category: "sports",
      signal: "high_demand",
      action: "BUY",
      confidence: 87,
      reasoning: "Home playoff game with strong local demand. Jokic MVP narrative driving national interest. Lower bowl trending up 18% since bracket locked.",
      estimated_roi_pct: 65
    },
    {
      event_name: "Kendrick Lamar — Empower Field",
      event_date: "Jul 25, 2026",
      venue: "Empower Field, Denver",
      category: "concert",
      signal: "on_sale_today",
      action: "BUY",
      confidence: 91,
      reasoning: "Stadium tour following massive album cycle. Presale demand 3x venue capacity. Floor sections historically yield 150%+ ROI on hip-hop stadium tours.",
      estimated_roi_pct: 140
    },
    {
      event_name: "Dead & Company — Red Rocks Night 2",
      event_date: "Jun 28, 2026",
      venue: "Red Rocks, Morrison",
      category: "concert",
      signal: "price_drop",
      action: "SELL",
      confidence: 79,
      reasoning: "3-night run splitting demand. Night 2 traditionally weakest. Floor prices down 12% this week. Cut positions before further erosion.",
      estimated_roi_pct: -8
    },
    {
      event_name: "Avalanche vs Stars — Rd 1 Game 1",
      event_date: "Apr 19, 2026",
      venue: "Ball Arena, Denver",
      category: "sports",
      signal: "high_demand",
      action: "BUY",
      confidence: 82,
      reasoning: "Home ice advantage, strong regular season finish. Playoff hockey in Denver consistently trades well. Get-in price still reasonable at $95.",
      estimated_roi_pct: 50
    },
    {
      event_name: "Billie Eilish — Ball Arena",
      event_date: "Aug 8, 2026",
      venue: "Ball Arena, Denver",
      category: "concert",
      signal: "price_spike",
      action: "HOLD",
      confidence: 72,
      reasoning: "New album reception mixed but tour demand steady. Arena shows typically see late surge 2-3 weeks out. Hold current positions, list at median +10%.",
      estimated_roi_pct: 35
    },
    {
      event_name: "Broncos vs Chiefs — Week 3",
      event_date: "Sep 21, 2026",
      venue: "Empower Field, Denver",
      category: "sports",
      signal: "low_supply",
      action: "WATCH",
      confidence: 76,
      reasoning: "Rivalry game with limited secondary inventory. Season ticket holders holding tight. Early acquisition at face could yield solid ROI.",
      estimated_roi_pct: 55
    }
  ],
  on_sales_today: [
    {
      event_name: "Kendrick Lamar — Empower Field",
      time: "10:00 AM MT",
      platform: "Ticketmaster Verified Fan",
      profit_potential: "high",
      notes: "Verified Fan presale. Expect instant sellout. Queue opens at 9:50 — be ready."
    },
    {
      event_name: "Tyler, The Creator — Red Rocks",
      time: "10:00 AM MT",
      platform: "AXS",
      profit_potential: "medium",
      notes: "Red Rocks premium, but GA only limits upside. Worth a small position."
    },
    {
      event_name: "Colorado Rockies July 4th Fireworks",
      time: "12:00 PM MT",
      platform: "Coors Field Box Office",
      profit_potential: "low",
      notes: "High supply, moderate demand. Only worth it for premium seats behind home plate."
    }
  ],
  social_signals: [
    {
      source: "ESPN",
      signal: "Jamal Murray cleared for full contact practice — playoff readiness confirmed",
      impact: "high",
      affected_events: ["Nuggets Playoff Games"]
    },
    {
      source: "Twitter/X",
      signal: "Kendrick announces surprise guest for Denver show — fan speculation exploding",
      impact: "high",
      affected_events: ["Kendrick Lamar — Empower Field"]
    },
    {
      source: "Spotify",
      signal: "Billie Eilish new single streaming 40% below previous release benchmarks",
      impact: "medium",
      affected_events: ["Billie Eilish — Ball Arena"]
    },
    {
      source: "Reddit r/Denver",
      signal: "Multiple posts about Dead & Co ticket prices being too high — buyer resistance",
      impact: "medium",
      affected_events: ["Dead & Company — Red Rocks"]
    }
  ],
  risk_alerts: [
    "Dead & Company Night 2 positions underwater — consider cutting at 5% loss vs holding",
    "Rockies fireworks game face value increased to $45 for premium — margins too thin, avoid"
  ],
  recommended_focus: "1) Kendrick on-sale at 10 AM is today's biggest opportunity. Full team attention from 9:50-10:15. Target floor and lower bowl ONLY. 2) Lock in Nuggets Game 3 positions before bracket hype peaks this weekend. 3) Reassess Dead & Co Night 2 by EOD — if floor drops another 5%, execute stop-loss."
};

export const SAMPLE_POSITIONS: Position[] = [
  { id: "1", eventName: "Kendrick Lamar — Empower Field", artistOrTeam: "Kendrick Lamar", venue: "Empower Field, Denver", eventDate: "2026-07-25", section: "Floor", quantity: 4, costPerTicket: 250, currentMarketPrice: 350, category: "concert", purchaseDate: "2026-03-15", priceTrend: "rising" },
  { id: "2", eventName: "Dead & Company — Red Rocks Night 2", artistOrTeam: "Dead & Company", venue: "Red Rocks, Morrison", eventDate: "2026-06-28", section: "GA", quantity: 8, costPerTicket: 180, currentMarketPrice: 158, category: "concert", purchaseDate: "2026-02-10", priceTrend: "declining" },
  { id: "3", eventName: "Billie Eilish — Ball Arena", artistOrTeam: "Billie Eilish", venue: "Ball Arena, Denver", eventDate: "2026-08-08", section: "Lower Bowl", quantity: 4, costPerTicket: 145, currentMarketPrice: 167, category: "concert", purchaseDate: "2026-03-01", priceTrend: "rising" },
  { id: "4", eventName: "Tyler, The Creator — Red Rocks", artistOrTeam: "Tyler, The Creator", venue: "Red Rocks, Morrison", eventDate: "2026-06-15", section: "GA", quantity: 6, costPerTicket: 95, currentMarketPrice: 119, category: "concert", purchaseDate: "2026-03-10", priceTrend: "rising" },
  { id: "5", eventName: "Olivia Rodrigo — Ball Arena", artistOrTeam: "Olivia Rodrigo", venue: "Ball Arena, Denver", eventDate: "2026-09-05", section: "Lower Bowl", quantity: 4, costPerTicket: 120, currentMarketPrice: 130, category: "concert", purchaseDate: "2026-03-20", priceTrend: "stable" },
  { id: "6", eventName: "Phish — Dick's Night 3", artistOrTeam: "Phish", venue: "Dick's Sporting Goods Park", eventDate: "2026-09-01", section: "GA", quantity: 6, costPerTicket: 110, currentMarketPrice: 108, category: "concert", purchaseDate: "2026-02-28", priceTrend: "stable" },
  { id: "7", eventName: "Red Hot Chili Peppers — Empower Field", artistOrTeam: "RHCP", venue: "Empower Field, Denver", eventDate: "2026-07-12", section: "Floor", quantity: 4, costPerTicket: 195, currentMarketPrice: 293, category: "concert", purchaseDate: "2026-03-05", priceTrend: "rising" },
  { id: "8", eventName: "Morgan Wallen — Empower Field", artistOrTeam: "Morgan Wallen", venue: "Empower Field, Denver", eventDate: "2026-06-20", section: "Lower Bowl", quantity: 6, costPerTicket: 135, currentMarketPrice: 128, category: "concert", purchaseDate: "2026-02-15", priceTrend: "declining" },
  { id: "9", eventName: "Nuggets vs Lakers — Rd 1 Game 3", artistOrTeam: "Nuggets", venue: "Ball Arena, Denver", eventDate: "2026-04-22", section: "Lower Bowl", quantity: 4, costPerTicket: 142, currentMarketPrice: 185, category: "sports", purchaseDate: "2026-03-25", priceTrend: "rising" },
  { id: "10", eventName: "Nuggets vs Lakers — Rd 1 Game 4", artistOrTeam: "Nuggets", venue: "Ball Arena, Denver", eventDate: "2026-04-24", section: "Lower Bowl", quantity: 4, costPerTicket: 135, currentMarketPrice: 162, category: "sports", purchaseDate: "2026-03-25", priceTrend: "rising" },
  { id: "11", eventName: "Avalanche vs Stars — Rd 1 Game 1", artistOrTeam: "Avalanche", venue: "Ball Arena, Denver", eventDate: "2026-04-19", section: "Lower Bowl", quantity: 4, costPerTicket: 95, currentMarketPrice: 119, category: "sports", purchaseDate: "2026-03-20", priceTrend: "rising" },
  { id: "12", eventName: "Broncos vs Chiefs — Week 3", artistOrTeam: "Broncos", venue: "Empower Field, Denver", eventDate: "2026-09-21", section: "Mid Level", quantity: 6, costPerTicket: 185, currentMarketPrice: 204, category: "sports", purchaseDate: "2026-03-15", priceTrend: "stable" },
  { id: "13", eventName: "Rockies July 4th Fireworks", artistOrTeam: "Rockies", venue: "Coors Field, Denver", eventDate: "2026-07-04", section: "Behind Home Plate", quantity: 4, costPerTicket: 45, currentMarketPrice: 48, category: "sports", purchaseDate: "2026-03-01", priceTrend: "stable" },
  { id: "14", eventName: "Colorado Rapids vs LAFC", artistOrTeam: "Rapids", venue: "Dick's Sporting Goods Park", eventDate: "2026-05-10", section: "Midfield", quantity: 4, costPerTicket: 35, currentMarketPrice: 33, category: "sports", purchaseDate: "2026-03-01", priceTrend: "declining" },
  { id: "15", eventName: "Hamilton — Denver Center", artistOrTeam: "Hamilton", venue: "Denver Center for the Performing Arts", eventDate: "2026-08-15", section: "Orchestra", quantity: 2, costPerTicket: 195, currentMarketPrice: 264, category: "theater", purchaseDate: "2026-03-10", priceTrend: "rising" },
  { id: "16", eventName: "Blue Man Group — Special Engagement", artistOrTeam: "Blue Man Group", venue: "Denver Center for the Performing Arts", eventDate: "2026-07-20", section: "Center Orch", quantity: 4, costPerTicket: 85, currentMarketPrice: 82, category: "theater", purchaseDate: "2026-03-12", priceTrend: "stable" },
  { id: "17", eventName: "Nuggets vs Lakers — Rd 1 Game 6", artistOrTeam: "Nuggets", venue: "Ball Arena, Denver", eventDate: "2026-04-28", section: "Upper Bowl", quantity: 6, costPerTicket: 65, currentMarketPrice: 78, category: "sports", purchaseDate: "2026-03-26", priceTrend: "rising" },
  { id: "18", eventName: "SZA — Ball Arena", artistOrTeam: "SZA", venue: "Ball Arena, Denver", eventDate: "2026-08-20", section: "Floor", quantity: 4, costPerTicket: 175, currentMarketPrice: 210, category: "concert", purchaseDate: "2026-03-18", priceTrend: "rising" },
  { id: "19", eventName: "Rockies vs Dodgers", artistOrTeam: "Rockies", venue: "Coors Field, Denver", eventDate: "2026-05-15", section: "Lower Box", quantity: 4, costPerTicket: 55, currentMarketPrice: 42, category: "sports", purchaseDate: "2026-02-20", priceTrend: "declining" },
  { id: "20", eventName: "Zach Bryan — Empower Field", artistOrTeam: "Zach Bryan", venue: "Empower Field, Denver", eventDate: "2026-06-08", section: "Floor", quantity: 4, costPerTicket: 165, currentMarketPrice: 225, category: "concert", purchaseDate: "2026-03-01", priceTrend: "rising" },
];

export const SAMPLE_WATCHLIST: WatchlistEvent[] = [
  { id: "w1", name: "Kendrick Lamar — Empower Field", category: "concert", eventDate: "2026-07-25", venue: "Empower Field, Denver", demandScore: 94, trend: "surging", lastAnalyzed: "2026-03-27T06:00:00" },
  { id: "w2", name: "Nuggets Playoff Game 3", category: "sports", eventDate: "2026-04-22", venue: "Ball Arena, Denver", demandScore: 87, trend: "rising", lastAnalyzed: "2026-03-27T06:00:00" },
  { id: "w3", name: "Red Hot Chili Peppers — Empower Field", category: "concert", eventDate: "2026-07-12", venue: "Empower Field, Denver", demandScore: 78, trend: "stable", lastAnalyzed: "2026-03-26T14:00:00" },
  { id: "w4", name: "Dead & Company — Red Rocks Night 2", category: "concert", eventDate: "2026-06-28", venue: "Red Rocks, Morrison", demandScore: 45, trend: "declining", lastAnalyzed: "2026-03-27T06:00:00" },
  { id: "w5", name: "Billie Eilish — Ball Arena", category: "concert", eventDate: "2026-08-08", venue: "Ball Arena, Denver", demandScore: 62, trend: "stable", lastAnalyzed: "2026-03-26T10:00:00" },
  { id: "w6", name: "Avalanche Playoff Game 1", category: "sports", eventDate: "2026-04-19", venue: "Ball Arena, Denver", demandScore: 81, trend: "rising", lastAnalyzed: "2026-03-27T06:00:00" },
  { id: "w7", name: "Tyler, The Creator — Red Rocks", category: "concert", eventDate: "2026-06-15", venue: "Red Rocks, Morrison", demandScore: 73, trend: "rising", lastAnalyzed: "2026-03-26T12:00:00" },
  { id: "w8", name: "Broncos vs Chiefs", category: "sports", eventDate: "2026-09-21", venue: "Empower Field, Denver", demandScore: 68, trend: "stable", lastAnalyzed: "2026-03-25T08:00:00" },
  { id: "w9", name: "Morgan Wallen — Empower Field", category: "concert", eventDate: "2026-06-20", venue: "Empower Field, Denver", demandScore: 55, trend: "declining", lastAnalyzed: "2026-03-26T14:00:00" },
  { id: "w10", name: "Hamilton — Denver Center", category: "theater", eventDate: "2026-08-15", venue: "Denver Center for the Performing Arts", demandScore: 70, trend: "stable", lastAnalyzed: "2026-03-25T10:00:00" },
  { id: "w11", name: "Olivia Rodrigo — Ball Arena", category: "concert", eventDate: "2026-09-05", venue: "Ball Arena, Denver" },
  { id: "w12", name: "Rockies July 4th", category: "sports", eventDate: "2026-07-04", venue: "Coors Field, Denver", demandScore: 35, trend: "stable", lastAnalyzed: "2026-03-24T08:00:00" },
];

export const SAMPLE_TRADES: Trade[] = [
  { id: "t1", eventName: "Nuggets vs Clippers", category: "sports", venue: "Ball Arena, Denver", buyDate: "2026-01-05", sellDate: "2026-01-12", section: "Lower Bowl", quantity: 4, costPerTicket: 85, salePrice: 135, platformSold: "StubHub", feesPaid: 81, notes: "Playoff positioning hype. Timed listing well." },
  { id: "t2", eventName: "Taylor Swift — Eras Tour", category: "concert", venue: "Empower Field, Denver", buyDate: "2025-12-01", sellDate: "2026-01-15", section: "Floor", quantity: 2, costPerTicket: 450, salePrice: 890, platformSold: "StubHub", feesPaid: 267, notes: "Massive demand. Should have bought more." },
  { id: "t3", eventName: "Rockies vs Dodgers", category: "sports", venue: "Coors Field, Denver", buyDate: "2026-01-10", sellDate: "2026-01-28", section: "Behind Home Plate", quantity: 6, costPerTicket: 65, salePrice: 48, platformSold: "Vivid Seats", feesPaid: 43.2, notes: "Overestimated Rockies demand. Lesson learned." },
  { id: "t4", eventName: "Deadmau5 — Red Rocks", category: "concert", venue: "Red Rocks, Morrison", buyDate: "2026-01-08", sellDate: "2026-01-25", section: "GA", quantity: 8, costPerTicket: 75, salePrice: 120, platformSold: "SeatGeek", feesPaid: 144, notes: "Red Rocks premium held up. Good margins." },
  { id: "t5", eventName: "Avalanche vs Wild", category: "sports", venue: "Ball Arena, Denver", buyDate: "2026-01-15", sellDate: "2026-01-22", section: "Upper Bowl", quantity: 4, costPerTicket: 40, salePrice: 35, platformSold: "StubHub", feesPaid: 21, notes: "Regular season hockey too risky in upper bowl." },
  { id: "t6", eventName: "Post Malone — Ball Arena", category: "concert", venue: "Ball Arena, Denver", buyDate: "2026-01-12", sellDate: "2026-02-05", section: "Lower Bowl", quantity: 4, costPerTicket: 110, salePrice: 165, platformSold: "Vivid Seats", feesPaid: 99, notes: "Solid win. Country crossover driving demand." },
  { id: "t7", eventName: "Nuggets vs Suns", category: "sports", venue: "Ball Arena, Denver", buyDate: "2026-01-20", sellDate: "2026-01-28", section: "Lower Bowl", quantity: 4, costPerTicket: 95, salePrice: 145, platformSold: "StubHub", feesPaid: 87, notes: "National TV game premium." },
  { id: "t8", eventName: "Wicked — Denver Center", category: "theater", venue: "Denver Center for the Performing Arts", buyDate: "2026-01-18", sellDate: "2026-02-10", section: "Orchestra", quantity: 2, costPerTicket: 165, salePrice: 240, platformSold: "StubHub", feesPaid: 72, notes: "Movie hype driving theater demand." },
  { id: "t9", eventName: "Rockies Opening Day", category: "sports", venue: "Coors Field, Denver", buyDate: "2026-02-01", sellDate: "2026-02-15", section: "Rooftop", quantity: 6, costPerTicket: 55, salePrice: 42, platformSold: "Vivid Seats", feesPaid: 37.8, notes: "Opening day isn't what it used to be for Rockies." },
  { id: "t10", eventName: "Doja Cat — Ball Arena", category: "concert", venue: "Ball Arena, Denver", buyDate: "2026-01-25", sellDate: "2026-02-12", section: "Floor", quantity: 4, costPerTicket: 135, salePrice: 195, platformSold: "SeatGeek", feesPaid: 117, notes: "Strong demand from Gen Z. Floor was the play." },
  { id: "t11", eventName: "Broncos vs Raiders", category: "sports", venue: "Empower Field, Denver", buyDate: "2026-02-05", sellDate: "2026-02-18", section: "Mid Level", quantity: 4, costPerTicket: 125, salePrice: 110, platformSold: "StubHub", feesPaid: 66, notes: "Late season, team out of contention. Bad buy." },
  { id: "t12", eventName: "Zach Bryan — Red Rocks", category: "concert", venue: "Red Rocks, Morrison", buyDate: "2026-02-01", sellDate: "2026-02-20", section: "Row 20", quantity: 4, costPerTicket: 120, salePrice: 285, platformSold: "StubHub", feesPaid: 171, notes: "Country + Red Rocks = money printer." },
  { id: "t13", eventName: "Nuggets vs Celtics", category: "sports", venue: "Ball Arena, Denver", buyDate: "2026-02-10", sellDate: "2026-02-22", section: "Lower Bowl", quantity: 4, costPerTicket: 110, salePrice: 175, platformSold: "Vivid Seats", feesPaid: 105, notes: "Championship rematch narrative. Easy sell." },
  { id: "t14", eventName: "Khruangbin — Red Rocks", category: "concert", venue: "Red Rocks, Morrison", buyDate: "2026-02-08", sellDate: "2026-02-25", section: "GA", quantity: 6, costPerTicket: 85, salePrice: 110, platformSold: "SeatGeek", feesPaid: 99, notes: "Modest win. Niche act, limited upside." },
  { id: "t15", eventName: "Colorado Rapids vs Galaxy", category: "sports", venue: "Dick's Sporting Goods Park", buyDate: "2026-02-12", sellDate: "2026-02-28", section: "Midfield", quantity: 4, costPerTicket: 30, salePrice: 22, platformSold: "TickPick", feesPaid: 0, notes: "MLS margins too thin. Not worth the effort." },
  { id: "t16", eventName: "SZA — Ball Arena", category: "concert", venue: "Ball Arena, Denver", buyDate: "2026-02-15", sellDate: "2026-03-05", section: "Lower Bowl", quantity: 4, costPerTicket: 125, salePrice: 210, platformSold: "StubHub", feesPaid: 126, notes: "Album hype still going strong." },
  { id: "t17", eventName: "Avalanche vs Blues", category: "sports", venue: "Ball Arena, Denver", buyDate: "2026-02-18", sellDate: "2026-03-01", section: "Lower Bowl", quantity: 4, costPerTicket: 55, salePrice: 48, platformSold: "Vivid Seats", feesPaid: 28.8, notes: "Reg season hockey keeps burning me." },
  { id: "t18", eventName: "Foo Fighters — Empower Field", category: "concert", venue: "Empower Field, Denver", buyDate: "2026-02-20", sellDate: "2026-03-08", section: "Floor", quantity: 4, costPerTicket: 175, salePrice: 310, platformSold: "StubHub", feesPaid: 186, notes: "Stadium rock still prints. Floor was key." },
  { id: "t19", eventName: "Nuggets vs Warriors", category: "sports", venue: "Ball Arena, Denver", buyDate: "2026-02-25", sellDate: "2026-03-08", section: "Lower Bowl", quantity: 4, costPerTicket: 105, salePrice: 160, platformSold: "StubHub", feesPaid: 96, notes: "Curry in Denver always draws. Reliable trade." },
  { id: "t20", eventName: "Rockies vs Giants", category: "sports", venue: "Coors Field, Denver", buyDate: "2026-02-28", sellDate: "2026-03-10", section: "Upper Deck", quantity: 6, costPerTicket: 25, salePrice: 18, platformSold: "Vivid Seats", feesPaid: 16.2, notes: "Stop buying Rockies upper deck. Just stop." },
  { id: "t21", eventName: "Hozier — Red Rocks", category: "concert", venue: "Red Rocks, Morrison", buyDate: "2026-03-01", sellDate: "2026-03-12", section: "GA", quantity: 6, costPerTicket: 90, salePrice: 145, platformSold: "SeatGeek", feesPaid: 130.5, notes: "Red Rocks indie/folk sweet spot." },
  { id: "t22", eventName: "Lana Del Rey — Ball Arena", category: "concert", venue: "Ball Arena, Denver", buyDate: "2026-03-02", sellDate: "2026-03-15", section: "Floor", quantity: 2, costPerTicket: 195, salePrice: 350, platformSold: "StubHub", feesPaid: 105, notes: "Cult following = reliable floor premium." },
  { id: "t23", eventName: "Broncos vs Chargers", category: "sports", venue: "Empower Field, Denver", buyDate: "2026-03-05", sellDate: "2026-03-18", section: "Lower Bowl", quantity: 4, costPerTicket: 145, salePrice: 135, platformSold: "Vivid Seats", feesPaid: 81, notes: "Chargers not a draw. Should have known." },
  { id: "t24", eventName: "Glass Animals — Red Rocks", category: "concert", venue: "Red Rocks, Morrison", buyDate: "2026-03-08", sellDate: "2026-03-20", section: "GA", quantity: 8, costPerTicket: 80, salePrice: 115, platformSold: "StubHub", feesPaid: 138, notes: "Decent margins. Red Rocks carries." },
  { id: "t25", eventName: "Nuggets vs Timberwolves", category: "sports", venue: "Ball Arena, Denver", buyDate: "2026-03-10", sellDate: "2026-03-22", section: "Lower Bowl", quantity: 4, costPerTicket: 90, salePrice: 140, platformSold: "StubHub", feesPaid: 84, notes: "Division rivalry premium. Good timing." },
];
