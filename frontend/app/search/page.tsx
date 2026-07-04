import { Suspense } from 'react';
import SearchResultsClient from '@/components/SearchResultsClient';

export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-8">Đang tải...</main>}>
      <SearchResultsClient />
    </Suspense>
  );
}
