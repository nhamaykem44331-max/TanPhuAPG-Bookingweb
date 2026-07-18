'use client';

import { useEffect, useRef, useState } from 'react';
import { PHONE_DISPLAY, PHONE_E164, ZALO_URL } from '@/lib/site';

// Panel chat với trợ lý AI — mở từ FloatingSupport, gọi /api/chatbot/web.
// anonId bám máy (localStorage) để giữ hội thoại; nội dung tin bám phiên (sessionStorage)
// để reload không mất khung chat nhưng đóng trình duyệt là gọn màn hình.

interface ChatMsg {
  role: 'user' | 'bot';
  text: string;
}

const ANON_KEY = 'apg_chat_anon_id';
const MSGS_KEY = 'apg_chat_msgs';
const MAX_INPUT = 1000;

const GREETING: ChatMsg = {
  role: 'bot',
  text: 'Em chào anh/chị 👋 Em là trợ lý của Tân Phú APG. Em có thể tìm chuyến bay, báo giá, tra cứu đơn đã đặt hoặc chuyển nhân viên hỗ trợ ạ.',
};

const QUICK_CHIPS = ['Tìm vé máy bay', 'Tra cứu đơn đã đặt', 'Gặp nhân viên tư vấn'];

function getAnonId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_KEY);
    if (existing && /^web_[a-z0-9]{16,64}$/.test(existing)) return existing;
    const fresh = `web_${crypto.randomUUID().replace(/-/g, '')}`;
    window.localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    // localStorage bị chặn (private mode) → id theo phiên, mất hội thoại khi reload.
    return `web_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  }
}

function loadMsgs(): ChatMsg[] {
  try {
    const raw = window.sessionStorage.getItem(MSGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMsg[]) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* hỏng thì bắt đầu mới */
  }
  return [GREETING];
}

/** Tách URL trong câu trả lời bot: link /dat-ve thành nút đặt vé, link khác thành anchor. */
function renderBotText(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;
    const url = part.replace(/[).,!?;:]+$/, ''); // bỏ dấu câu dính cuối URL
    const tail = part.slice(url.length);
    if (url.includes('/dat-ve')) {
      return (
        <span key={i}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold text-white transition hover:opacity-90"
            style={{ background: 'var(--apg-aviation-navy)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
            </svg>
            Mở trang đặt vé
          </a>
          {tail}
        </span>
      );
    }
    return (
      <span key={i}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold underline">
          {url}
        </a>
        {tail}
      </span>
    );
  });
}

export default function ChatWidget({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(loadMsgs);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anonIdRef = useRef<string>('');

  useEffect(() => {
    anonIdRef.current = getAnonId();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(MSGS_KEY, JSON.stringify(msgs.slice(-40)));
    } catch {
      /**/
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, sending]);

  async function send(text: string) {
    const trimmed = text.trim().slice(0, MAX_INPUT);
    if (!trimmed || sending) return;
    setMsgs((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/chatbot/web', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anonId: anonIdRef.current, message: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as { reply?: string; maintenance?: boolean } | null;
      const reply =
        data?.reply ||
        `Dạ em đang gặp trục trặc, anh/chị gọi hotline ${PHONE_DISPLAY} để được hỗ trợ ngay nhé ạ.`;
      setMsgs((m) => [...m, { role: 'bot', text: reply }]);
      if (data?.maintenance) setMaintenance(true);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'bot', text: `Dạ mạng đang chập chờn, anh/chị thử gửi lại hoặc gọi ${PHONE_DISPLAY} giúp em ạ.` },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const showChips = msgs.length <= 1 && !sending && !maintenance;

  return (
    <div
      role="dialog"
      aria-label="Chat với trợ lý Tân Phú APG"
      className="fixed right-3 bottom-3 z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_48px_rgba(10,79,134,0.28)] print:hidden sm:right-6 sm:bottom-6"
      style={{
        width: 'min(380px, calc(100vw - 24px))',
        height: 'min(560px, calc(100dvh - 88px))',
        border: '1px solid var(--apg-border-default, #e2e8f0)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: 'var(--apg-aviation-navy)' }}>
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-tight">Trợ lý Tân Phú APG</div>
          <div className="text-[11.5px] text-white/75">Hỗ trợ tìm vé & tra cứu đơn 24/7</div>
        </div>
        <button
          type="button"
          aria-label="Đóng chat"
          onClick={onClose}
          className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-white/15"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Danh sách tin */}
      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3" style={{ background: '#f6f8fb' }}>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                m.role === 'user' ? 'rounded-br-md text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
              }`}
              style={m.role === 'user' ? { background: 'var(--apg-aviation-navy)' } : undefined}
            >
              {m.role === 'bot' ? renderBotText(m.text) : m.text}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: `${d * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {showChips && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => send(chip)}
                className="rounded-full border bg-white px-3 py-1.5 text-[12.5px] font-semibold transition hover:text-white"
                style={{ borderColor: 'var(--apg-aviation-navy)', color: 'var(--apg-aviation-navy)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--apg-aviation-navy)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {maintenance && (
          <div className="flex flex-col items-stretch gap-1.5 pt-1">
            <a
              href={ZALO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2 text-center text-[13px] font-bold text-white"
              style={{ background: '#0068FF' }}
            >
              Chat Zalo với nhân viên
            </a>
            <a
              href={`tel:${PHONE_E164}`}
              className="rounded-lg border px-3 py-2 text-center text-[13px] font-bold"
              style={{ borderColor: 'var(--apg-aviation-navy)', color: 'var(--apg-aviation-navy)' }}
            >
              Gọi hotline {PHONE_DISPLAY}
            </a>
          </div>
        )}
      </div>

      {/* Ô nhập */}
      <form
        className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          maxLength={MAX_INPUT}
          disabled={maintenance}
          onChange={(e) => setInput(e.target.value)}
          placeholder={maintenance ? 'Chat đang bảo trì' : 'Nhập tin nhắn…'}
          aria-label="Tin nhắn gửi trợ lý"
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[14px] outline-none transition focus:border-[var(--apg-aviation-navy)] focus:bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || maintenance || !input.trim()}
          aria-label="Gửi tin nhắn"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: 'var(--apg-aviation-navy)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </form>
      <div className="bg-white px-3 pb-2 text-center text-[10.5px] text-slate-400">
        Trợ lý AI — thông tin quan trọng sẽ được nhân viên xác nhận lại.
      </div>
    </div>
  );
}
