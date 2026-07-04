import HomeSearchExperience from '@/components/home/HomeSearchExperience';
import { triggerNamThanhSessionWarmup } from '@/lib/namthanh-warmup';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  void triggerNamThanhSessionWarmup('home-page-request');
  return <HomeSearchExperience />;
}
