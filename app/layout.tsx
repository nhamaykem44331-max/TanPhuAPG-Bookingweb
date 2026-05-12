import './globals.css';
import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono, Raleway } from 'next/font/google';
import WebVitalsReporter from '@/components/analytics/WebVitalsReporter';

const fontSans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
  display: 'swap',
});

const fontDisplay = Raleway({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Đặt vé máy bay - TAN PHU APG',
  description: 'So sánh giá vé máy bay và giữ chỗ qua TAN PHU APG.',
  keywords: 'vé máy bay, đặt vé, TAN PHU APG, Hà Nội, TP.HCM, giá vé',
  metadataBase: new URL('https://book.tanphuapg.com'),
  openGraph: {
    title: 'Đặt vé máy bay - TAN PHU APG',
    description: 'So sánh giá vé máy bay nội địa và quốc tế. Đặt vé qua TAN PHU APG.',
    url: 'https://book.tanphuapg.com',
    siteName: 'TAN PHU APG',
    images: [
      {
        url: '/assets/tanphu-apg-logo.jpg',
        width: 800,
        height: 800,
        alt: 'TAN PHU APG - Corporate Aviation Services',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Đặt vé máy bay - TAN PHU APG',
    description: 'So sánh giá vé máy bay và đặt vé qua TAN PHU APG.',
    images: ['/assets/tanphu-apg-logo.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}>
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
