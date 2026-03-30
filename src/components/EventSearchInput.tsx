import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, Music, Trophy, Theater, Mic, PartyPopper, HelpCircle } from 'lucide-react'
import { searchEvents } from './APIClient'
import type { EventSearchResult } from '../lib/types'

const CATEGORY_ICONS: Record<string, typeof Music> = {
  concert: Music,
  sports: Trophy,
  theater: Theater,
  comedy: Mic,
  festival: PartyPopper,
  other: HelpCircle,
}

interface EventSearchInputProps {
  onSelect: (result: EventSearchResult) => void
  initialValue?: string
}

export default function EventSearchInput({ onSelect, initialValue = '' }: EventSearchInputProps) {
  const [query, setQuery] = useState(initialValue)
  const [results, setResults] = useState<EventSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [manualMode, setManualMode] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = useRef<AbortController>(undefined)

  // Update query when initialValue changes externally
  useEffect(() => {
    if (initialValue) setQuery(initialValue)
  }, [initialValue])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const doSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setIsSearching(true)
    try {
      const data = await searchEvents(searchQuery)
      setResults(data)
      setIsOpen(data.length > 0)
      setHighlightedIndex(-1)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (manualMode) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 350)
  }

  const handleSelect = (result: EventSearchResult) => {
    setQuery(result.name)
    setIsOpen(false)
    setResults([])
    onSelect(result)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(results[highlightedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  if (manualMode) {
    return (
      <div>
        <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Event / Artist / Team</label>
        <input
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            onSelect({ id: '', name: e.target.value, venue: '', date: '', category: 'other', source: 'manual' })
          }}
          className="w-full rounded px-3 py-2.5 text-sm border outline-none"
          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          placeholder="e.g. Kendrick Lamar — Empower Field"
        />
        <button onClick={() => setManualMode(false)} className="mt-1 text-xs underline" style={{ color: 'var(--accent-blue)' }}>
          Switch to event search
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Search Events
      </label>
      <div className="relative">
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          className="w-full rounded px-3 py-2.5 text-sm border outline-none"
          style={{ background: 'var(--bg-primary)', borderColor: isOpen ? 'var(--accent-blue)' : 'var(--border-default)', color: 'var(--text-primary)', paddingLeft: 32 }}
          placeholder="Search for events, artists, teams..."
        />
        {isSearching && (
          <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-blue)' }} />
        )}
      </div>
      <button onClick={() => setManualMode(true)} className="mt-1 text-xs underline" style={{ color: 'var(--accent-blue)' }}>
        or enter details manually
      </button>

      {/* Dropdown results */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg border overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {results.map((r, i) => {
            const Icon = CATEGORY_ICONS[r.category] || HelpCircle
            return (
              <button
                key={r.id || i}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors"
                style={{
                  background: highlightedIndex === i ? 'var(--bg-card-hover)' : 'transparent',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border-default)' : 'none',
                }}
              >
                <Icon size={16} style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {r.venue && (
                      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.venue}</span>
                    )}
                    {r.price_range && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#064e3b', color: '#6ee7b7', fontSize: 10 }}>{r.price_range}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {r.date && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(r.date)}</div>}
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{r.source}</div>
                </div>
              </button>
            )
          })}
          {results.length === 0 && !isSearching && (
            <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No events found. You can enter details manually below.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
