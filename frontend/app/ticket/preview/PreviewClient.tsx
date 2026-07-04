'use client';

import { useState } from 'react';
import TicketFace, { type TicketStatus } from '@/components/ticket/TicketFace';
import {
  SAMPLE_LEGS,
  SAMPLE_PASSENGERS,
  SAMPLE_PRICE,
  SAMPLE_QUOTE,
  SAMPLE_HOLD,
  SAMPLE_PAID,
  SAMPLE_REFERENCE,
} from './sample';

const STATES: { value: TicketStatus; label: string }[] = [
  { value: 'quote', label: 'Báo giá' },
  { value: 'hold', label: 'Giữ chỗ' },
  { value: 'paid', label: 'Đã thanh toán' },
];

export default function PreviewClient({ initial }: { initial?: TicketStatus }) {
  const [status, setStatus] = useState<TicketStatus>(initial || 'quote');
  // Mặc định: quote/hold = hiện giá; paid = ẩn giá (theo đề xuất agent toggle)
  const [showPrice, setShowPrice] = useState<boolean>(true);

  function selectStatus(next: TicketStatus) {
    setStatus(next);
    setShowPrice(next !== 'paid');
  }

  return (
    <div style={{ background: '#EEF1F4', minHeight: '100dvh', padding: '24px 14px 40px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {STATES.map((s) => {
            const active = s.value === status;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => selectStatus(s.value)}
                data-status={s.value}
                aria-pressed={active}
                style={{
                  padding: '9px 15px',
                  borderRadius: 980,
                  border: active ? '1px solid #0C2740' : '0.5px solid #D2D2D7',
                  background: active ? '#0C2740' : '#fff',
                  color: active ? '#fff' : '#586675',
                  font: '500 13px/1 var(--font-sans), "Be Vietnam Pro", system-ui, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {status !== 'quote' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#586675' }}>Tùy chọn agent:</span>
            <button
              type="button"
              onClick={() => setShowPrice((v) => !v)}
              aria-pressed={showPrice}
              style={{
                padding: '8px 14px',
                borderRadius: 980,
                border: showPrice ? '1px solid #0C2740' : '0.5px solid #D2D2D7',
                background: showPrice ? '#0C2740' : '#fff',
                color: showPrice ? '#fff' : '#586675',
                font: '500 12.5px/1 var(--font-sans), "Be Vietnam Pro", system-ui, sans-serif',
                cursor: 'pointer',
              }}
            >
              Giá tiền: {showPrice ? 'Hiện' : 'Ẩn'}
            </button>
          </div>
        )}
      </div>

      <TicketFace
        status={status}
        referenceCode={SAMPLE_REFERENCE[status]}
        legs={SAMPLE_LEGS}
        passengers={SAMPLE_PASSENGERS}
        price={SAMPLE_PRICE}
        quote={status === 'quote' ? SAMPLE_QUOTE : undefined}
        hold={status === 'hold' ? SAMPLE_HOLD : undefined}
        paid={status === 'paid' ? SAMPLE_PAID : undefined}
        showPrice={showPrice}
      />
    </div>
  );
}
