import Image from 'next/image';
import { BLOG_POSTS, blogUrl, FACEBOOK_URL, ZALO_URL } from '@/lib/site';

const PHOTO_SIZES = '(max-width:560px) 100vw, (max-width:980px) 50vw, 33vw';

const ROUTES = [
  { img: 'img-4', from: 'HAN', to: 'SGN', cities: 'Hà Nội — TP. Hồ Chí Minh', air: 'VN · VJ · QH · Bamboo', price: '1.890.000', intl: false },
  { img: 'img-5', from: 'HAN', to: 'DAD', cities: 'Hà Nội — Đà Nẵng', air: 'VN · VJ · QH', price: '990.000', intl: false },
  { img: 'img-6', from: 'SGN', to: 'PQC', cities: 'TP. Hồ Chí Minh — Phú Quốc', air: 'VN · VJ', price: '1.190.000', intl: false },
  { img: 'img-7', from: 'HAN', to: 'CXR', cities: 'Hà Nội — Nha Trang', air: 'VN · VJ · QH', price: '1.290.000', intl: false },
  { img: 'img-8', from: 'HAN', to: 'ICN', cities: 'Hà Nội — Seoul (Incheon)', air: 'VN · OZ · KE · VJ', price: '4.900.000', intl: true },
  { img: 'img-9', from: 'SGN', to: 'BKK', cities: 'TP. Hồ Chí Minh — Bangkok', air: 'VJ · TG · VN', price: '2.350.000', intl: true },
];

const DEALS = [
  { img: 'img-10', badge: '−30%', tag: 'Vé Tết sớm', title: 'Hà Nội đi TP.HCM dịp cao điểm', routeIcon: 'i-plane', route: 'HAN → SGN · khứ hồi', now: '2.650.000đ', old: '3.790.000đ', sec: 40920, cd: '11:22:00' },
  { img: 'img-11', badge: '−22%', tag: 'Combo đoàn', title: 'Vé đoàn 10+ khách đi hội thảo', routeIcon: 'i-users', route: 'Giữ chỗ theo đoàn · giá cố định', now: 'Báo giá riêng', old: null as string | null, sec: 93600, cd: '26:00:00' },
  { img: 'img-12', badge: '−15%', tag: 'Quốc tế', title: 'TP.HCM đi Bangkok mùa du lịch', routeIcon: 'i-plane', route: 'SGN → BKK · một chiều', now: '1.990.000đ', old: '2.350.000đ', sec: 18300, cd: '05:05:00' },
];

export function TrustSection() {
  return (
    <section className="trust">
      <div className="container">
        <div className="trust-item"><div className="trust-ic"><svg className="ic"><use href="#i-shield" /></svg></div><div><b>Đại lý Amadeus cấp 1</b><span>Truy cập trực tiếp hệ thống GDS</span></div></div>
        <div className="trust-item"><div className="trust-ic"><svg className="ic"><use href="#i-receipt" /></svg></div><div><b>Xuất hóa đơn VAT</b><span>Đầy đủ cho doanh nghiệp</span></div></div>
        <div className="trust-item"><div className="trust-ic"><svg className="ic"><use href="#i-refresh" /></svg></div><div><b>Hoàn / đổi / hủy</b><span>Linh hoạt, hỗ trợ tận nơi</span></div></div>
        <div className="trust-item"><div className="trust-ic"><svg className="ic"><use href="#i-support" /></svg></div><div><b>Hỗ trợ 24/7</b><span>Gọi & Zalo bất cứ lúc nào</span></div></div>
      </div>
    </section>
  );
}

export function RoutesSection() {
  return (
    <section className="section routes" id="routes">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Đường bay phổ biến</span>
          <h2 className="sec-title">Giá vé tốt cho những <span className="accent">chặng bay đông khách</span> nhất.</h2>
        </div>
        <div className="grid grid-3">
          {ROUTES.map((r) => (
            <a className="route" key={`${r.from}-${r.to}`} href="/dat-ve" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="route-photo">
                <Image src={`/landing/${r.img}.jpg`} alt={`Vé máy bay ${r.cities} (${r.from} - ${r.to})`} fill sizes={PHOTO_SIZES} style={{ objectFit: 'cover' }} />
                <div className="route-codes">{r.from} <svg className="ic"><use href="#i-plane" /></svg> {r.to}</div>
                {r.intl && <span className="route-intl">QUỐC TẾ</span>}
              </div>
              <div className="route-body"><div className="route-cities">{r.cities}</div><div className="route-air">{r.air}</div><div className="route-price"><span className="from">chỉ từ</span><span className="amt tnum">{r.price}<span>đ</span></span></div></div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DealsSection() {
  return (
    <section className="section deals" id="deals">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Vé giá tốt hôm nay</span>
          <h2 className="sec-title">Ưu đãi <span style={{ color: 'var(--amber)' }}>có hạn</span> — số lượng và thời gian giới hạn.</h2>
        </div>
        <div className="grid grid-3">
          {DEALS.map((d) => (
            <a className="deal" key={d.img} href="/dat-ve" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="deal-photo">
                <Image src={`/landing/${d.img}.jpg`} alt={`Ưu đãi vé máy bay: ${d.title}`} fill sizes={PHOTO_SIZES} style={{ objectFit: 'cover' }} />
                <span className="deal-badge">{d.badge}</span>
              </div>
              <div className="deal-body">
                <span className="deal-tag">{d.tag}</span>
                <h3>{d.title}</h3>
                <div className="deal-route"><svg className="ic"><use href={`#${d.routeIcon}`} /></svg> {d.route}</div>
                <div className="deal-price"><span className={d.old ? 'now tnum' : 'now'}>{d.now}</span>{d.old && <span className="old tnum">{d.old}</span>}</div>
                <div className="deal-count"><svg className="ic"><use href="#i-clock" /></svg><span className="cd tnum" data-sec={d.sec}>{d.cd}</span><span className="lbl">còn lại</span></div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServicesSection() {
  return (
    <section className="section services" id="services">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow on-dark">Dịch vụ chuyên biệt</span>
          <h2 className="sec-title">Không chỉ bán vé — chúng tôi <span style={{ color: '#7FE3A8' }}>xử lý cả những ca khó</span>.</h2>
          <p>Những nhóm khách cần nhiều hơn một tấm vé: giấy tờ, giữ chỗ theo đoàn, công nợ, đổi lịch gấp. Đây là phần Tân Phú APG làm tốt nhất.</p>
        </div>
        <div className="grid grid-4">
          <div className="svc"><div className="svc-ic"><svg className="ic"><use href="#i-anchor" /></svg></div><h3>Vé thuyền viên</h3><p>Giá ưu đãi cho thuyền viên, hỗ trợ giấy tờ và linh hoạt đổi lịch khi tàu thay đổi.</p><a href="/cam-nang/ve-may-bay-thuyen-vien">Tìm hiểu thêm<svg className="ic"><use href="#i-arrow" /></svg></a></div>
          <div className="svc"><div className="svc-ic"><svg className="ic"><use href="#i-users" /></svg></div><h3>Vé đoàn 9+ khách</h3><p>Giữ chỗ theo đoàn, giá cố định, thanh toán linh hoạt cho hội thảo, du lịch công ty.</p><a href="/dat-ve">Báo giá vé đoàn<svg className="ic"><use href="#i-arrow" /></svg></a></div>
          <div className="svc"><div className="svc-ic"><svg className="ic"><use href="#i-bag" /></svg></div><h3>Khách doanh nghiệp</h3><p>Công nợ, báo cáo chi phí đi lại và xuất hóa đơn VAT đầy đủ theo từng kỳ.</p><a href="/xuat-hoa-don-vat">Mở tài khoản công ty<svg className="ic"><use href="#i-arrow" /></svg></a></div>
          <div className="svc"><div className="svc-ic"><svg className="ic"><use href="#i-cap" /></svg></div><h3>Du học & XKLĐ</h3><p>Vé một chiều, hành lý lớn, tư vấn lịch trình và điểm nối chuyến phù hợp.</p><a href="/dat-ve">Tư vấn lịch bay<svg className="ic"><use href="#i-arrow" /></svg></a></div>
        </div>
      </div>
    </section>
  );
}

export function AirlinesSection() {
  return (
    <section className="section airlines">
      <div className="container">
        <div className="lab">Đặt vé trên mọi hãng bay trong nước & quốc tế</div>
        <div className="air-row">
          <span className="air-chip">Vietnam Airlines</span>
          <span className="air-chip">Vietjet Air</span>
          <span className="air-chip">Bamboo Airways</span>
          <span className="air-chip">Vietravel Airlines</span>
          <span className="air-chip">Pacific Airlines</span>
          <span className="air-chip more">& 500+ hãng quốc tế</span>
        </div>
      </div>
    </section>
  );
}

export function WhySection() {
  return (
    <section className="section why">
      <div className="container why-wrap">
        <div>
          <span className="eyebrow">Vì sao chọn Tân Phú APG</span>
          <h2 className="sec-title">Đại lý cấp 1 thật sự, bay đến đâu cũng có <span className="accent">Tân Phú</span>.</h2>
          <p>Tân Phú APG là đại lý vé máy bay cấp 1 thuộc HTX Vận tải Ô tô Tân Phú, đặt vé trực tiếp qua hệ thống Amadeus GDS. Chúng tôi phục vụ doanh nghiệp, đại lý cấp dưới và khách lẻ trên toàn quốc — đặt vé từ xa, xuất vé điện tử và hỗ trợ tận nơi, với đội ngũ theo sát từng đơn từ lúc đặt đến lúc bay.</p>
          <a href="/ve-chung-toi" className="btn btn-navy" style={{ marginTop: '22px' }}>Về chúng tôi <svg className="ic"><use href="#i-arrow" /></svg></a>
        </div>
        <div className="why-stats">
          <div className="stat"><div className="num tnum">10<span>+</span></div><div className="lbl">năm kinh nghiệm ngành vé</div></div>
          <div className="stat"><div className="num tnum">500<span>+</span></div><div className="lbl">hãng bay toàn cầu</div></div>
          <div className="stat"><div className="num">24/7</div><div className="lbl">hỗ trợ qua gọi & Zalo</div></div>
          <div className="stat"><div className="num">4</div><div className="lbl">cơ sở: TN · HN · KH · PT</div></div>
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="sec-head center">
          <span className="eyebrow">Khách hàng nói gì</span>
          <h2 className="sec-title">Được tin dùng bởi doanh nghiệp và khách bay thường xuyên.</h2>
        </div>
        <div className="grid grid-3">
          <div className="tm"><div className="tm-stars"><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg></div><p>"Công ty mình đặt vé công tác hàng tuần qua Tân Phú. Hóa đơn VAT ra nhanh, cần gấp lúc nào cũng có người hỗ trợ."</p><div className="tm-who"><div className="tm-av">TU</div><div><b>Anh Tuấn</b><span>Trưởng phòng hành chính</span></div></div></div>
          <div className="tm"><div className="tm-stars"><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg></div><p>"Đặt vé cho cả đoàn 15 người đi hội thảo. Giữ chỗ và báo giá rất nhanh, không phải lo thiếu vé giờ chót."</p><div className="tm-who"><div className="tm-av">HG</div><div><b>Chị Hương</b><span>Khách đoàn doanh nghiệp</span></div></div></div>
          <div className="tm"><div className="tm-stars"><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg><svg className="ic"><use href="#i-star" /></svg></div><p>"Vé thuyền viên gấp, lịch tàu thay đổi liên tục. Các bạn lo hết giấy tờ và đổi lịch giúp mình."</p><div className="tm-who"><div className="tm-av">DU</div><div><b>Anh Dũng</b><span>Thuyền viên</span></div></div></div>
        </div>
      </div>
    </section>
  );
}

export function BlogSection() {
  return (
    <section className="section deals" id="blog">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Cẩm nang bay</span>
          <h2 className="sec-title">Mẹo đặt vé & kinh nghiệm bay cho người đi <span className="accent">vì công việc</span>.</h2>
        </div>
        <div className="grid grid-3">
          {BLOG_POSTS.map((post) => {
            const [y, m, d] = post.date.split('-');
            return (
              <article className="post" key={post.slug}>
                <div className="post-img"><Image src={post.image} alt={post.title} fill sizes={PHOTO_SIZES} style={{ objectFit: 'cover' }} /></div>
                <div className="post-body">
                  <div className="post-date">{`${d}/${m}/${y}`}</div>
                  <h3><a href={blogUrl(post.slug)}>{post.title}</a></h3>
                  <p>{post.excerpt}</p>
                  <a className="more" href={blogUrl(post.slug)}>Đọc thêm <svg className="ic"><use href="#i-arrow" /></svg></a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="section cta">
      <div className="container">
        <span className="eyebrow on-dark">Sẵn sàng bay?</span>
        <h2>Cần vé gấp hay báo giá vé đoàn?</h2>
        <p>Gọi hoặc nhắn Zalo cho Tân Phú APG — đội ngũ hỗ trợ 24/7, phản hồi nhanh kể cả ngoài giờ hành chính.</p>
        <div className="cta-btns">
          <a href="tel:0918752686" className="btn btn-green btn-lg"><svg className="ic"><use href="#i-phone" /></svg> Gọi hotline: 0918.752.686</a>
          <a href={ZALO_URL} target="_blank" rel="noopener" className="btn btn-ghost-light btn-lg"><svg className="ic"><use href="#i-chat" /></svg> Nhắn Zalo</a>
        </div>
      </div>
    </section>
  );
}

export function FooterSection() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="foot-links">
          <div>
            <div className="brand"><Image src="/assets/tanphu-apg-logo.jpg" alt="Tân Phú APG" width={42} height={42} className="foot-logo" /><span><span className="bn">TAN PHU APG</span><span className="bs">A member of Tan Phu Auto Transport Cooperative</span></span></div>
            <p className="foot-about">Đại lý vé máy bay cấp 1 (Amadeus GDS) thuộc HTX Vận tải Ô tô Tân Phú. Phục vụ doanh nghiệp, đại lý cấp dưới và khách lẻ trên mọi đường bay trong nước và quốc tế.</p>
          </div>
          <div className="foot-col">
            <h4>Dịch vụ</h4>
            <ul>
              <li><a href="/#routes">Đường bay phổ biến</a></li>
              <li><a href="/#services">Vé đoàn 9+ khách</a></li>
              <li><a href="/#services">Khách doanh nghiệp</a></li>
              <li><a href="/#services">Vé thuyền viên</a></li>
              <li><a href="/#services">Du học & XKLĐ</a></li>
            </ul>
          </div>
          <div className="foot-col">
            <h4>Thông tin</h4>
            <ul>
              <li><a href="/ve-chung-toi">Về chúng tôi</a></li>
              <li><a href="/huong-dan-dat-ve">Hướng dẫn đặt vé</a></li>
              <li><a href="/xuat-hoa-don-vat">Xuất hóa đơn VAT</a></li>
              <li><a href="/hoan-doi-huy-ve">Hoàn / đổi / hủy vé</a></li>
              <li><a href="/cau-hoi-thuong-gap">Câu hỏi thường gặp</a></li>
            </ul>
          </div>
        </div>

        <div className="foot-bar">
          <div style={{ fontSize: '.9rem', color: 'var(--muted-navy)' }}>Liên hệ đặt vé & báo giá đoàn — gọi trực tiếp hoặc nhắn Zalo OA.</div>
          <a href="tel:0918752686" className="foot-hot"><span className="lab">Hotline</span><b className="tnum">0918.752.686</b></a>
        </div>

        <div className="branches">
          <div className="branch"><div className="bt">Trụ sở chính</div><div className="bc">Thái Nguyên</div><div className="ba">Tổ 9, Phường Tích Lương, Tỉnh Thái Nguyên</div></div>
          <div className="branch"><div className="bt">Chi nhánh</div><div className="bc">Hà Nội</div><div className="ba">323 Xuân Đỉnh, TP Hà Nội</div></div>
          <div className="branch"><div className="bt">Chi nhánh</div><div className="bc">Khánh Hòa</div><div className="ba">Phường Nha Trang, Tỉnh Khánh Hòa</div></div>
          <div className="branch"><div className="bt">Chi nhánh</div><div className="bc">Phú Thọ</div><div className="ba">Phường Phúc Yên, Tỉnh Phú Thọ</div></div>
        </div>

        <div className="foot-bottom">
          <small>© 2026 TAN PHU APG · MST: 4600111735 · tanphuapg.com</small>
          <div className="foot-social">
            <a href={FACEBOOK_URL} target="_blank" rel="noopener" aria-label="Facebook"><svg className="ic"><use href="#i-fb" /></svg></a>
            <a href={ZALO_URL} target="_blank" rel="noopener" aria-label="Zalo"><svg className="ic"><use href="#i-chat" /></svg></a>
            <a href="tel:0918752686" aria-label="Gọi"><svg className="ic"><use href="#i-phone" /></svg></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
