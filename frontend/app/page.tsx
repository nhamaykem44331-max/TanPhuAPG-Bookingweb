import type { Metadata } from 'next';
import '@/components/landing/landing.css';
import LandingIcons from '@/components/landing/LandingIcons';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingSearchForm from '@/components/landing/LandingSearchForm';
import HeroEffects from '@/components/landing/HeroEffects';
import {
  TrustSection,
  RoutesSection,
  DealsSection,
  ServicesSection,
  AirlinesSection,
  WhySection,
  TestimonialsSection,
  BlogSection,
  CtaSection,
  FooterSection,
} from '@/components/landing/LandingSections';
import { SITE_URL, PHONE_E164 as PHONE, OG_IMAGE } from '@/lib/site';

// Trang chủ landing tối ưu SEO (đứng trước màn tìm vé /dat-ve).
// Static render được (không có dữ liệu động) → LCP tốt.

export const metadata: Metadata = {
  title: 'Tân Phú APG — Đặt vé máy bay giá đại lý cấp 1 | Thái Nguyên',
  description:
    'Tân Phú APG — đại lý vé máy bay cấp 1 (Amadeus) tại Thái Nguyên. Đặt vé nội địa & quốc tế, vé đoàn, vé thuyền viên, doanh nghiệp. Xuất hóa đơn VAT, hỗ trợ 24/7.',
  keywords: [
    'đại lý vé máy bay',
    'vé máy bay Thái Nguyên',
    'đặt vé máy bay',
    'vé máy bay giá rẻ',
    'vé đoàn',
    'vé thuyền viên',
    'xuất hóa đơn VAT',
    'Tân Phú APG',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Tân Phú APG — Đại lý vé máy bay cấp 1 tại Thái Nguyên',
    description:
      'Đặt vé máy bay nội địa & quốc tế, vé đoàn, vé thuyền viên, khách doanh nghiệp. Xuất hóa đơn VAT, hỗ trợ 24/7.',
    url: '/',
    type: 'website',
    locale: 'vi_VN',
    siteName: 'TAN PHU APG',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Tân Phú APG — Đại lý vé máy bay cấp 1 tại Thái Nguyên' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tân Phú APG — Đại lý vé máy bay cấp 1 tại Thái Nguyên',
    description: 'Đặt vé nội địa & quốc tế, vé đoàn, vé thuyền viên, doanh nghiệp. Xuất hóa đơn VAT.',
    images: [OG_IMAGE],
  },
};

const BRANCHES = [
  { name: 'Tân Phú APG — Trụ sở chính Thái Nguyên', street: 'Tổ 9, Phường Tích Lương', locality: 'Thái Nguyên', region: 'Thái Nguyên' },
  { name: 'Tân Phú APG — Chi nhánh Hà Nội', street: '323 Xuân Đỉnh', locality: 'Hà Nội', region: 'Hà Nội' },
  { name: 'Tân Phú APG — Chi nhánh Khánh Hòa', street: 'Phường Nha Trang', locality: 'Nha Trang', region: 'Khánh Hòa' },
  { name: 'Tân Phú APG — Chi nhánh Phú Thọ', street: 'Phường Phúc Yên', locality: 'Phúc Yên', region: 'Phú Thọ' },
];

const FAQ = [
  {
    q: 'Tân Phú APG có phải đại lý vé máy bay cấp 1 không?',
    a: 'Có. Tân Phú APG là đại lý vé máy bay cấp 1 truy cập trực tiếp hệ thống Amadeus GDS, thuộc Hợp tác xã Vận tải Ô tô Tân Phú, phục vụ doanh nghiệp, đại lý cấp dưới và khách lẻ.',
  },
  {
    q: 'Tân Phú APG có xuất hóa đơn VAT không?',
    a: 'Có, chúng tôi xuất hóa đơn VAT đầy đủ cho doanh nghiệp và khách lẻ trên mọi đường bay nội địa và quốc tế.',
  },
  {
    q: 'Tân Phú APG có những cơ sở nào?',
    a: 'Tân Phú APG có 4 cơ sở: trụ sở chính tại Thái Nguyên và các chi nhánh tại Hà Nội, Khánh Hòa và Phú Thọ.',
  },
  {
    q: 'Đặt vé đoàn và vé thuyền viên như thế nào?',
    a: 'Liên hệ hotline 0918.752.686 hoặc nhắn Zalo OA để được giữ chỗ theo đoàn, báo giá cố định, và hỗ trợ giấy tờ cho vé thuyền viên.',
  },
];

function jsonLd() {
  const org = {
    '@type': ['TravelAgency', 'LocalBusiness'],
    '@id': `${SITE_URL}/#organization`,
    name: 'Tân Phú APG',
    alternateName: 'TAN PHU APG',
    url: SITE_URL,
    telephone: PHONE,
    image: `${SITE_URL}/assets/tanphu-apg-logo.jpg`,
    logo: `${SITE_URL}/assets/tanphu-apg-logo.jpg`,
    taxID: '4600111735',
    vatID: '4600111735',
    priceRange: '$$',
    areaServed: 'VN',
    parentOrganization: { '@type': 'Organization', name: 'Hợp tác xã Vận tải Ô tô Tân Phú' },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Tổ 9, Phường Tích Lương',
      addressLocality: 'Thái Nguyên',
      addressRegion: 'Thái Nguyên',
      addressCountry: 'VN',
    },
    department: BRANCHES.map((b) => ({
      '@type': 'LocalBusiness',
      name: b.name,
      telephone: PHONE,
      address: {
        '@type': 'PostalAddress',
        streetAddress: b.street,
        addressLocality: b.locality,
        addressRegion: b.region,
        addressCountry: 'VN',
      },
    })),
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Tân Phú APG',
    inLanguage: 'vi-VN',
    publisher: { '@id': `${SITE_URL}/#organization` },
  };

  const faq = {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#faq`,
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL }],
  };

  return { '@context': 'https://schema.org', '@graph': [org, website, faq, breadcrumb] };
}

export default function LandingPage() {
  const ld = JSON.stringify(jsonLd()).replace(/</g, '\\u003c');

  return (
    <>
      {/* Ảnh hero LCP giờ dùng next/image priority → Next tự inject preload bản đã tối ưu
          (AVIF/WebP responsive); không preload JPG gốc để tránh tải trùng. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <LandingHeader />
      <div className="lp">
        <LandingIcons />

      <main>
      {/* HERO */}
      <section className="hero" id="search">
        <div className="globe-hero">
          <HeroEffects />
          <div className="container globe-inner">
            <div className="promo">
              <h1>Chào mừng bạn đến với <span style={{ whiteSpace: 'nowrap' }}>Tân Phú APG</span> <span className="badge">Amadeus GDS</span></h1>
              <p className="sub">
                Vé nội địa &amp; quốc tế · vé đoàn · vé thuyền viên · Vé Du học · Vé Lao Động · khách doanh nghiệp — giá đại lý cấp 1, xuất VAT, hỗ trợ 24/7.
              </p>
              <a href="/dat-ve" className="plink">Đặt vé ngay <svg className="ic"><use href="#i-arrow" /></svg></a>
            </div>
          </div>
        </div>
      </section>

      <LandingSearchForm />

      <TrustSection />
      <RoutesSection />
      <DealsSection />
      <ServicesSection />
      <AirlinesSection />
      <WhySection />
      <TestimonialsSection />
      <BlogSection />
      <CtaSection />
      </main>

      <FooterSection />
      </div>
    </>
  );
}
