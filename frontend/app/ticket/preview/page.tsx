import PreviewClient from './PreviewClient';
import type { TicketStatus } from '@/components/ticket/TicketFace';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Preview mặt vé — Tan Phu APG',
  robots: 'noindex,nofollow',
};

export default function TicketPreviewPage({ searchParams }: { searchParams?: { status?: string } }) {
  const raw = String(searchParams?.status || '').toLowerCase();
  const initial: TicketStatus = raw === 'hold' || raw === 'paid' ? raw : 'quote';
  return <PreviewClient initial={initial} />;
}
