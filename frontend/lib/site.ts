// Hằng số site + registry nội dung dùng chung cho metadata, sitemap, footer, blog.

// URL gốc cho canonical/OG/sitemap. Ưu tiên NEXT_PUBLIC_SITE_URL (đặt trên Vercel),
// tự nhận domain Vercel khi deploy, mặc định localhost khi test cục bộ.
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();
export const FACEBOOK_URL = 'https://www.facebook.com/tanphuapg';
export const ZALO_URL = 'https://zalo.me/0918752686';
export const OG_IMAGE = '/og-cover.jpg'; // 1200x630, ảnh khoang thương gia + thương hiệu
export const SITE_NAME = 'Tân Phú APG';
export const PHONE_DISPLAY = '0918.752.686';
export const PHONE_E164 = '+84918752686';
export const TAX_ID = '4600111735';

export type InfoPage = { slug: string; title: string; description: string };
export type BlogPost = { slug: string; title: string; date: string; excerpt: string; icon: string; image: string };

// Trang thông tin (footer "Thông tin")
export const INFO_PAGES: InfoPage[] = [
  {
    slug: 've-chung-toi',
    title: 'Về chúng tôi',
    description: 'Tân Phú APG — đại lý vé máy bay cấp 1 (Amadeus GDS) thuộc HTX Vận tải Ô tô Tân Phú, 4 cơ sở tại Thái Nguyên, Hà Nội, Khánh Hòa và Phú Thọ.',
  },
  {
    slug: 'huong-dan-dat-ve',
    title: 'Hướng dẫn đặt vé',
    description: 'Các bước đặt vé máy bay tại Tân Phú APG: tìm chuyến, chọn giá, giữ chỗ, thanh toán và nhận vé điện tử.',
  },
  {
    slug: 'xuat-hoa-don-vat',
    title: 'Xuất hóa đơn VAT',
    description: 'Tân Phú APG xuất hóa đơn VAT đầy đủ cho vé máy bay nội địa và quốc tế, phục vụ doanh nghiệp và khách lẻ.',
  },
  {
    slug: 'hoan-doi-huy-ve',
    title: 'Hoàn / đổi / hủy vé',
    description: 'Chính sách và quy trình hoàn vé, đổi ngày bay, hủy vé máy bay tại Tân Phú APG — hỗ trợ tận nơi, nhanh chóng.',
  },
  {
    slug: 'cau-hoi-thuong-gap',
    title: 'Câu hỏi thường gặp',
    description: 'Giải đáp các câu hỏi thường gặp khi đặt vé máy bay tại Tân Phú APG: đại lý cấp 1, hóa đơn VAT, vé đoàn, vé thuyền viên.',
  },
];

// Bài cẩm nang (blog)
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'san-ve-may-bay-gia-re-cong-tac',
    title: 'Cách săn vé máy bay giá rẻ cho chuyến công tác',
    date: '2026-06-18',
    excerpt: 'Đặt sớm, chọn khung giờ và linh hoạt ngày bay — vài nguyên tắc giúp tiết kiệm đáng kể chi phí đi lại.',
    icon: 'i-plane',
    image: '/landing/blog-1.jpg',
  },
  {
    slug: 'hanh-ly-ky-gui-xach-tay-2026',
    title: 'Hành lý ký gửi và xách tay: quy định mới nhất 2026',
    date: '2026-06-12',
    excerpt: 'Mỗi hãng một mức cân và kích thước. Bảng tổng hợp nhanh để không bị phụ thu ở sân bay.',
    icon: 'i-bag',
    image: '/landing/blog-2.jpg',
  },
  {
    slug: 've-may-bay-thuyen-vien',
    title: 'Vé máy bay cho thuyền viên: giấy tờ cần chuẩn bị',
    date: '2026-06-05',
    excerpt: 'Từ hợp đồng lao động đến thư mời lên tàu — chuẩn bị đủ để mua vé ưu đãi và bay đúng lịch.',
    icon: 'i-anchor',
    image: '/landing/blog-3.jpg',
  },
];

export function infoUrl(slug: string) { return `/${slug}`; }
export function blogUrl(slug: string) { return `/cam-nang/${slug}`; }
