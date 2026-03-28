import { useState, useRef, useEffect } from 'react';
import { callClaude } from '../components/APIClient';
import type { Message } from '../lib/types';
import {
  Hash,
  ChevronDown,
  Pin,
  Users,
  Send,
  Plus,
  Bell,
  Bookmark,
  Menu,
  X,
  TrendingUp,
  Zap,
  Calendar,
  ShieldAlert,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Pre-loaded showcase conversation                                   */
/* ------------------------------------------------------------------ */

const PRELOADED_MESSAGES: Message[] = [
  {
    id: '1',
    user: 'sarah',
    avatar: 'SJ',
    isBot: false,
    content:
      'Good morning team. Big day — Kendrick presale at 10, Nuggets game 3 tix hitting secondary any minute.',
    timestamp: '7:12 AM',
  },
  {
    id: '2',
    user: 'mike',
    avatar: 'MK',
    isBot: false,
    content:
      "@TradeBot what's the current floor for Nuggets vs Lakers Game 3?",
    timestamp: '7:13 AM',
  },
  {
    id: '3',
    user: 'TradeBot',
    avatar: 'TB',
    isBot: true,
    content: `**Nuggets vs Lakers — Rd 1 Game 3**
Ball Arena, Denver | Apr 22

**Floor:** $142 | **Median:** $245 | **Get-in:** $89
**Trend:** up 14% over past 7 days

*Comparable:* Last year's Rd 1 Game 3 peaked at $285 floor for lower bowl.
*Signal:* High demand. Murray's return driving national interest.`,
    timestamp: '7:13 AM',
    reactions: [
      { emoji: '📈', count: 3 },
      { emoji: '🔥', count: 2 },
    ],
  },
  {
    id: '4',
    user: 'joe',
    avatar: 'JD',
    isBot: false,
    content:
      "What about Red Rocks Dead & Co night 2? We're holding 8 tickets.",
    timestamp: '7:15 AM',
  },
  {
    id: '5',
    user: 'TradeBot',
    avatar: 'TB',
    isBot: true,
    content: `**Dead & Company — Red Rocks Night 2**
Red Rocks, Morrison | Jun 28

**Floor:** $165 | **Median:** $210 | **Your cost basis:** ~$180
**Trend:** down 12% this week

3-night run splitting demand. Night 1 and 3 holding steady, Night 2 getting squeezed.

**Recommendation:** List now at $195. If floor drops below $155 by EOD, cut losses.`,
    timestamp: '7:15 AM',
    reactions: [
      { emoji: '👀', count: 4 },
      { emoji: '💡', count: 1 },
    ],
  },
  {
    id: '6',
    user: 'sarah',
    avatar: 'SJ',
    isBot: false,
    content:
      '@TradeBot Kendrick Empower Field — full analysis. Floor seats at face ($250).',
    timestamp: '7:17 AM',
  },
  {
    id: '7',
    user: 'TradeBot',
    avatar: 'TB',
    isBot: true,
    content: `**Kendrick Lamar — Empower Field**
Denver | Jul 25 | Presale: TODAY 10 AM

**Verdict: STRONG BUY at face (92% confidence)**

**Demand signals:**
• Presale registrations 3.2x venue capacity
• Spotify streams up 280% since tour announcement
• Denver has no competing hip-hop stadium date within 6 weeks

**Comps:**
• Travis Scott — Empower Field '24: face $195 → peak $520 (167% ROI)
• Drake — Ball Arena '25: face $175 → peak $410 (134% ROI)

**Expected ROI:** 100-180% for floor, 40-70% for lower bowl

**Strategy:** Focus floor and lower bowl ONLY. Upper bowl margins too thin at $250 face. List 3 weeks before show.

**Team allocation:** 60% floor, 40% lower bowl. Max position: 12 tickets.`,
    timestamp: '7:17 AM',
    reactions: [
      { emoji: '🚀', count: 5 },
      { emoji: '💰', count: 3 },
      { emoji: '📈', count: 2 },
    ],
  },
  {
    id: '8',
    user: 'mike',
    avatar: 'MK',
    isBot: false,
    content: "Let's go heavy. I'm queuing up at 9:55.",
    timestamp: '7:19 AM',
  },
  {
    id: '9',
    user: 'sarah',
    avatar: 'SJ',
    isBot: false,
    content:
      '@TradeBot set an alert if Kendrick floor drops below $350 on secondary after on-sale.',
    timestamp: '7:19 AM',
  },
  {
    id: '10',
    user: 'TradeBot',
    avatar: 'TB',
    isBot: true,
    content:
      "**Alert set:** Kendrick Lamar floor seats < $350. I'll ping #price-alerts when it triggers.",
    timestamp: '7:19 AM',
  },
];

/* ------------------------------------------------------------------ */
/*  Channel & command data                                             */
/* ------------------------------------------------------------------ */

const CHANNELS = [
  { name: 'morning-trading', unread: false },
  { name: 'price-alerts', unread: true },
  { name: 'trade-log', unread: false },
  { name: 'general', unread: false },
];

const BOT_COMMANDS = [
  '/price [event]',
  '/comp [event]',
  '/analyze [event] $[price]',
  '/alerts',
  '/trending',
  '/log [trade]',
];

const QUICK_COMMANDS = [
  {
    label: 'Market Pulse',
    icon: TrendingUp,
    message: '@TradeBot Give me a market pulse — what are the biggest movers on secondary right now?',
  },
  {
    label: 'Trending',
    icon: Zap,
    message: '@TradeBot What events are trending up in demand this week?',
  },
  {
    label: 'On-Sales Today',
    icon: Calendar,
    message: "@TradeBot What on-sales are happening today and which ones should we target?",
  },
  {
    label: 'Risk Check',
    icon: ShieldAlert,
    message: '@TradeBot Run a risk check on our current inventory positions.',
  },
];

/* ------------------------------------------------------------------ */
/*  Avatar colors                                                      */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS: Record<string, string> = {
  SJ: '#e06c75',
  MK: '#61afef',
  JD: '#98c379',
  TB: '#c678dd',
  YOU: '#e5c07b',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(): string {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function renderMarkdown(text: string) {
  // Split into lines, then process inline markdown
  return text.split('\n').map((line, li) => {
    const parts: (string | React.ReactElement)[] = [];
    // bold
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let last = 0;
    let m;
    let ki = 0;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1]) {
        parts.push(
          <strong key={`b${li}-${ki}`} style={{ color: '#e2e3e5', fontWeight: 700 }}>
            {m[1]}
          </strong>,
        );
      } else if (m[2]) {
        parts.push(
          <em key={`i${li}-${ki}`} style={{ color: '#abb2bf' }}>
            {m[2]}
          </em>,
        );
      }
      last = m.index + m[0].length;
      ki++;
    }
    if (last < line.length) parts.push(line.slice(last));

    // bullet lines
    const isBullet = line.trim().startsWith('•');

    return (
      <span
        key={li}
        style={{
          display: 'block',
          paddingLeft: isBullet ? 8 : 0,
          minHeight: line.trim() === '' ? 8 : undefined,
        }}
      >
        {parts.length ? parts : line}
      </span>
    );
  });
}

/* ------------------------------------------------------------------ */
/*  STYLES (CSS-in-JS)                                                 */
/* ------------------------------------------------------------------ */

const styles = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: '#1a1d21',
    color: '#d1d2d3',
    fontFamily:
      "'Lato', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  /* Sidebar */
  sidebar: {
    width: 220,
    minWidth: 220,
    background: '#19171d',
    display: 'flex',
    flexDirection: 'column' as const,
    borderRight: '1px solid #35363a',
  },
  sidebarHeader: {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #35363a',
  },
  workspaceName: {
    fontWeight: 900,
    fontSize: 16,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  sectionLabel: {
    padding: '12px 16px 4px',
    fontSize: 12,
    fontWeight: 700,
    color: '#9a9b9d',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  channelItem: (active: boolean) =>
    ({
      padding: '3px 16px 3px 24px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 15,
      fontWeight: active ? 900 : 400,
      color: active ? '#fff' : '#b9bbbe',
      background: active ? '#1164a3' : 'transparent',
      borderRadius: active ? 6 : 0,
      margin: active ? '0 8px' : 0,
      transition: 'background 0.15s',
    }) as React.CSSProperties,
  commandItem: {
    padding: '2px 16px 2px 24px',
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontSize: 13,
    color: '#9a9b9d',
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  /* Main */
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0,
    background: '#1a1d21',
  },
  header: {
    height: 50,
    minHeight: 50,
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #35363a',
    gap: 12,
  },
  channelTitle: {
    fontWeight: 900,
    fontSize: 18,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  headerMeta: {
    fontSize: 13,
    color: '#616061',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginLeft: 'auto',
  },
  /* Messages */
  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px',
  },
  messageRow: (isBot: boolean) =>
    ({
      display: 'flex',
      gap: 10,
      padding: '8px 8px',
      borderRadius: 6,
      marginBottom: 2,
      background: isBot ? '#1c2333' : 'transparent',
      transition: 'background 0.12s',
    }) as React.CSSProperties,
  avatar: (bg: string, isBot: boolean) =>
    ({
      width: 36,
      height: 36,
      minWidth: 36,
      borderRadius: isBot ? 8 : '50%',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: 13,
      color: '#fff',
      border: isBot ? '2px solid #5865f2' : 'none',
    }) as React.CSSProperties,
  username: (isBot: boolean) =>
    ({
      fontWeight: 700,
      color: isBot ? '#7cacf8' : '#d1d2d3',
      fontSize: 15,
      display: 'inline',
    }) as React.CSSProperties,
  botBadge: {
    display: 'inline-block',
    background: '#5865f2',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 3,
    marginLeft: 6,
    verticalAlign: 'middle',
  },
  timestamp: {
    fontSize: 12,
    color: '#616061',
    marginLeft: 8,
    fontWeight: 400,
  },
  msgContent: {
    lineHeight: 1.5,
    color: '#d1d2d3',
    marginTop: 2,
  },
  reactions: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap' as const,
  },
  reactionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: '#2b2d31',
    border: '1px solid #3f4147',
    borderRadius: 12,
    padding: '2px 8px',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  /* Typing indicator */
  typingWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 8px',
  },
  dotContainer: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  /* Input */
  inputArea: {
    padding: '8px 20px 16px',
    borderTop: '1px solid #35363a',
  },
  quickRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap' as const,
  },
  quickBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    borderRadius: 20,
    border: '1px solid #3f4147',
    background: '#2b2d31',
    color: '#b9bbbe',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontWeight: 500,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#222529',
    borderRadius: 8,
    border: '1px solid #3f4147',
    padding: '4px 8px 4px 12px',
    transition: 'border-color 0.2s',
  },
  textInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#d1d2d3',
    fontSize: 15,
    padding: '8px 0',
    fontFamily: 'inherit',
  },
  sendBtn: (active: boolean) =>
    ({
      width: 32,
      height: 32,
      borderRadius: 6,
      background: active ? '#1d9bd1' : '#3f4147',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: active ? 'pointer' : 'default',
      transition: 'background 0.15s',
    }) as React.CSSProperties,
  /* Mobile overlay */
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 90,
  },
  mobileToggle: {
    display: 'none',
    position: 'absolute' as const,
    top: 10,
    left: 10,
    zIndex: 100,
    background: '#2b2d31',
    border: '1px solid #3f4147',
    borderRadius: 6,
    padding: 6,
    color: '#d1d2d3',
    cursor: 'pointer',
  },
};

/* ------------------------------------------------------------------ */
/*  Bounce keyframes injected once                                     */
/* ------------------------------------------------------------------ */

const BOUNCE_STYLE_ID = 'tradebot-bounce';
function injectBounce() {
  if (document.getElementById(BOUNCE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOUNCE_STYLE_ID;
  style.textContent = `
    @keyframes tb-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    .tb-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #9a9b9d;
      display: inline-block; animation: tb-bounce 1.4s infinite ease-in-out both;
    }
    .tb-dot:nth-child(1) { animation-delay: -0.32s; }
    .tb-dot:nth-child(2) { animation-delay: -0.16s; }
    .tb-dot:nth-child(3) { animation-delay: 0s; }

    .tb-msg-row:hover { background: #26282d !important; }
    .tb-quick:hover { background: #3f4147 !important; border-color: #5865f2 !important; color: #fff !important; }
    .tb-cmd:hover { color: #e2e3e5 !important; }
    .tb-reaction:hover { border-color: #5865f2 !important; }
    .tb-input-focus { border-color: #5865f2 !important; }

    @media (max-width: 768px) {
      .tb-sidebar { position: fixed !important; z-index: 95; height: 100vh; transform: translateX(-100%); transition: transform 0.25s; }
      .tb-sidebar.open { transform: translateX(0); }
      .tb-mobile-toggle { display: flex !important; }
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TradeBot() {
  const [messages, setMessages] = useState<Message[]>(PRELOADED_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState('morning-trading');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectBounce();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  /* ---- send ---- */
  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInputValue('');

    const userMsg: Message = {
      id: crypto.randomUUID(),
      user: 'You',
      avatar: 'YOU',
      isBot: false,
      content: trimmed,
      timestamp: formatTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const systemPrompt = `You are TradeBot, a ticket market trading assistant embedded in a Slack-style team channel. Keep responses under 150 words. Use **bold** for emphasis and key data points. Include specific numbers, prices, and percentages wherever possible. Use web search to get real, current data about events, ticket prices, and market conditions. Format your responses cleanly with line breaks for readability. Never use markdown headers (#). Use bullet points (•) for lists.`;

      const raw = await callClaude(
        `${systemPrompt}\n\nUser message: ${trimmed}`,
        true,
      );
      const botMsg: Message = {
        id: crypto.randomUUID(),
        user: 'TradeBot',
        avatar: 'TB',
        isBot: true,
        content: raw,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        user: 'TradeBot',
        avatar: 'TB',
        isBot: true,
        content: '**Error:** Could not reach the analysis engine. Please try again.',
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send(inputValue);
  };

  const prefill = (cmd: string) => {
    setInputValue(cmd);
  };

  /* ---- render ---- */
  return (
    <div style={styles.wrapper}>
      {/* Mobile hamburger */}
      <button
        className="tb-mobile-toggle"
        style={styles.mobileToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ======== SIDEBAR ======== */}
      <aside
        className={`tb-sidebar ${sidebarOpen ? 'open' : ''}`}
        style={styles.sidebar}
      >
        {/* Workspace */}
        <div style={styles.sidebarHeader}>
          <span style={styles.workspaceName}>
            TicketOps HQ <ChevronDown size={14} />
          </span>
          <Plus size={16} style={{ color: '#9a9b9d', cursor: 'pointer' }} />
        </div>

        {/* Channels */}
        <div style={styles.sectionLabel}>Channels</div>
        {CHANNELS.map((ch) => (
          <div
            key={ch.name}
            style={styles.channelItem(activeChannel === ch.name)}
            onClick={() => {
              setActiveChannel(ch.name);
              setSidebarOpen(false);
            }}
          >
            <Hash size={14} style={{ opacity: 0.6 }} />
            <span>{ch.name}</span>
            {ch.unread && (
              <span
                style={{
                  marginLeft: 'auto',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#e06c75',
                }}
              />
            )}
          </div>
        ))}

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: '#35363a',
            margin: '12px 16px',
          }}
        />

        {/* Bot commands */}
        <div style={styles.sectionLabel}>Bot Commands</div>
        {BOT_COMMANDS.map((cmd) => (
          <div
            key={cmd}
            className="tb-cmd"
            style={styles.commandItem}
            onClick={() => prefill(cmd)}
          >
            {cmd}
          </div>
        ))}
      </aside>

      {/* ======== MAIN ======== */}
      <main style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.channelTitle}>
            <Hash size={18} />
            {activeChannel}
          </div>
          <div style={styles.headerMeta}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={14} /> 6
            </span>
            <Pin size={14} />
            <Bookmark size={14} />
            <Bell size={14} />
          </div>
        </div>

        {/* Messages */}
        <div style={styles.messageList}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="tb-msg-row"
              style={styles.messageRow(msg.isBot)}
            >
              {/* Avatar */}
              <div
                style={styles.avatar(
                  AVATAR_COLORS[msg.avatar] || '#5865f2',
                  msg.isBot,
                )}
              >
                {msg.isBot ? '⬡' : msg.avatar}
              </div>

              {/* Body */}
              <div style={{ minWidth: 0 }}>
                <div>
                  <span style={styles.username(msg.isBot)}>{msg.user}</span>
                  {msg.isBot && <span style={styles.botBadge}>APP</span>}
                  <span style={styles.timestamp}>{msg.timestamp}</span>
                </div>
                <div style={styles.msgContent}>
                  {renderMarkdown(msg.content)}
                </div>
                {msg.reactions && msg.reactions.length > 0 && (
                  <div style={styles.reactions}>
                    {msg.reactions.map((r, i) => (
                      <span key={i} className="tb-reaction" style={styles.reactionPill}>
                        {r.emoji} {r.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={styles.typingWrapper}>
              <div
                style={styles.avatar(AVATAR_COLORS.TB, true)}
              >
                ⬡
              </div>
              <div>
                <div style={styles.dotContainer}>
                  <span className="tb-dot" />
                  <span className="tb-dot" />
                  <span className="tb-dot" />
                </div>
                <span style={{ fontSize: 12, color: '#616061' }}>
                  TradeBot is typing...
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={styles.inputArea}>
          {/* Quick commands */}
          <div style={styles.quickRow}>
            {QUICK_COMMANDS.map((qc) => (
              <button
                key={qc.label}
                className="tb-quick"
                style={styles.quickBtn}
                onClick={() => send(qc.message)}
              >
                <qc.icon size={14} />
                {qc.label}
              </button>
            ))}
          </div>

          {/* Text input */}
          <div
            style={styles.inputRow}
            className={inputFocused ? 'tb-input-focus' : ''}
          >
            <Plus size={18} style={{ color: '#616061', cursor: 'pointer' }} />
            <input
              style={styles.textInput}
              placeholder="Ask TradeBot anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
            <button
              style={styles.sendBtn(inputValue.trim().length > 0)}
              onClick={() => send(inputValue)}
            >
              <Send size={16} color="#fff" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
