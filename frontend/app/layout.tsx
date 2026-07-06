import './globals.css';
import './redesign.css';
import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono, Raleway, Fraunces, Playfair_Display } from 'next/font/google';
import WebVitalsReporter from '@/components/analytics/WebVitalsReporter';
import FloatingSupport from '@/components/FloatingSupport';
import { SITE_URL, OG_IMAGE } from '@/lib/site';

// KHÔNG preload font nào — trên mobile 4G giả lập, việc preload nhiều file font ở
// mức High tranh băng thông với CSS render-blocking, làm chậm FCP/LCP. LCP của
// landing là ẢNH hero (không phải chữ) nên để font swap (display:swap) không ảnh
// hưởng LCP; chữ hiện ngay bằng fallback khớp metric rồi swap sang font thật.
const fontSans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
  display: 'swap',
  preload: false,
});

// Font trang trí (display/serif/fancy/mono): preload:false + weight đúng mức thực dùng.

const fontDisplay = Raleway({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
  preload: false,
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

// Fraunces (serif) — chỉ dùng cho con số/tiêu đề "điểm nhấn" cần cảm giác cao cấp.
const fontSerif = Fraunces({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700', '900'],
  variable: '--font-serif',
  display: 'swap',
  preload: false,
});

// Playfair Display — serif sang trọng cho riêng tiêu đề hero landing (chỉ weight 800).
const fontFancy = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  weight: ['800'],
  variable: '--font-fancy',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Đặt vé máy bay - TAN PHU APG',
  description: 'So sánh giá vé máy bay và giữ chỗ qua TAN PHU APG.',
  keywords: 'vé máy bay, đặt vé, TAN PHU APG, Hà Nội, TP.HCM, giá vé',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Đặt vé máy bay - TAN PHU APG',
    description: 'So sánh giá vé máy bay nội địa và quốc tế. Đặt vé qua TAN PHU APG.',
    url: '/',
    siteName: 'TAN PHU APG',
    locale: 'vi_VN',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Tân Phú APG — Đại lý vé máy bay cấp 1' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Đặt vé máy bay - TAN PHU APG',
    description: 'So sánh giá vé máy bay và đặt vé qua TAN PHU APG.',
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} ${fontSerif.variable} ${fontFancy.variable}`}>
        <WebVitalsReporter />
        {children}
        <FloatingSupport />
      </body>
    </html>
  );
}
