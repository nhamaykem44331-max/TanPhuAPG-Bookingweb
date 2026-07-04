import { Suspense } from 'react';
import HomeSearchExperience from '@/components/home/HomeSearchExperience';
import { triggerNamThanhSessionWarmup } from '@/lib/namthanh-warmup';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tìm & đặt vé máy bay - TAN PHU APG',
  description: 'So sánh giá vé máy bay nội địa & quốc tế theo thời gian thực và giữ chỗ qua Tân Phú APG.',
  alternates: { canonical: '/dat-ve' },
};

export default function DatVePage() {
  void triggerNamThanhSessionWarmup('dat-ve-page-request');
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-8">Đang tải…</main>}>
      <HomeSearchExperience />
    </Suspense>
  );
}
