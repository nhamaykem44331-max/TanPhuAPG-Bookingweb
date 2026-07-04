import type { Metadata } from 'next';
import Image from 'next/image';
import LandingShell from '@/components/landing/LandingShell';
import { BLOG_POSTS, blogUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Cẩm nang bay — kinh nghiệm đặt vé máy bay | Tân Phú APG',
  description:
    'Cẩm nang bay của Tân Phú APG: kinh nghiệm săn vé máy bay giá rẻ, quy định hành lý ký gửi và xách tay 2026, thủ tục vé thuyền viên và mẹo đặt vé tiết kiệm.',
  alternates: { canonical: '/cam-nang' },
};

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Cẩm nang', url: '/cam-nang' },
      ]}
    >
      <div className="blog-grid">
        <div className="blog-head">
          <h1>Cẩm nang bay</h1>
          <p>
            Tổng hợp kinh nghiệm thực tế từ đội ngũ Tân Phú APG — đại lý vé máy bay cấp 1 truy cập trực tiếp
            hệ thống Amadeus GDS. Từ cách săn vé giá tốt, quy định hành lý cập nhật đến thủ tục vé chuyên biệt,
            mỗi bài viết giúp bạn chuẩn bị kỹ trước khi bay. Khi đã chọn được hành trình, bạn có thể{' '}
            <a href="/dat-ve">tìm và đặt vé trực tuyến</a> hoặc xem trước{' '}
            <a href="/huong-dan-dat-ve">hướng dẫn đặt vé chi tiết</a>.
          </p>
        </div>

        <div className="grid grid-3">
          {BLOG_POSTS.map((post) => {
            const [y, m, d] = post.date.split('-');
            return (
              <article className="post" key={post.slug}>
                <div className="post-img">
                  <Image src={post.image} alt={post.title} fill sizes="(max-width:560px) 100vw, (max-width:980px) 50vw, 33vw" style={{ objectFit: 'cover' }} />
                </div>
                <div className="post-body">
                  <div className="post-date">{`${d}/${m}/${y}`}</div>
                  <h3>
                    <a href={blogUrl(post.slug)}>{post.title}</a>
                  </h3>
                  <p>{post.excerpt}</p>
                  <a className="more" href={blogUrl(post.slug)}>
                    Đọc thêm{' '}
                    <svg className="ic">
                      <use href="#i-arrow" />
                    </svg>
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <div className="doc-cta">
          <a className="btn btn-green" href="/dat-ve">
            <svg className="ic">
              <use href="#i-search" />
            </svg>{' '}
            Tìm chuyến bay
          </a>
          <a className="btn btn-navy" href="tel:0918752686">
            <svg className="ic">
              <use href="#i-phone" />
            </svg>{' '}
            Gọi 0918.752.686
          </a>
        </div>
      </div>
    </LandingShell>
  );
}
