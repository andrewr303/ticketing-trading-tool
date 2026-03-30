-- Supabase Schema for Ticketing Trading Tool
-- Run this in the Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Positions (current inventory)
create table positions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  event_name text not null,
  artist_or_team text not null,
  venue text not null,
  event_date date not null,
  section text not null,
  quantity int not null,
  cost_per_ticket numeric(10,2) not null,
  current_market_price numeric(10,2) not null,
  category text not null check (category in ('concert','sports','theater')),
  purchase_date date not null,
  price_trend text not null check (price_trend in ('rising','stable','declining')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Completed trades (P&L history)
create table trades (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  event_name text not null,
  category text not null check (category in ('concert','sports','theater','festival','other')),
  venue text not null,
  buy_date date not null,
  sell_date date not null,
  section text not null,
  quantity int not null,
  cost_per_ticket numeric(10,2) not null,
  sale_price numeric(10,2) not null,
  platform_sold text not null check (platform_sold in ('StubHub','Vivid Seats','SeatGeek','TickPick','Other')),
  fees_paid numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz default now()
);

-- Watchlist
create table watchlist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  name text not null,
  category text not null check (category in ('concert','sports','theater')),
  event_date date not null,
  venue text not null,
  demand_score int,
  trend text check (trend in ('surging','rising','stable','declining','crashing')),
  last_analyzed timestamptz,
  created_at timestamptz default now()
);

-- Daily briefs (cached AI-generated briefs)
create table briefs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  brief_date date not null default current_date,
  data jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, brief_date)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table positions enable row level security;
alter table trades enable row level security;
alter table watchlist enable row level security;
alter table briefs enable row level security;

create policy "Users manage own positions" on positions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own trades" on trades
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own watchlist" on watchlist
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own briefs" on briefs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- AUTO-UPDATE TRIGGER
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger positions_updated_at
  before update on positions
  for each row execute function update_updated_at();
