import type { Metadata } from 'next';
import LandingShell from '@/components/landing/LandingShell';

export const metadata: Metadata = {
  title: 'Câu hỏi thường gặp về đặt vé máy bay | Tân Phú APG',
  description:
    'Giải đáp câu hỏi thường gặp khi đặt vé máy bay tại Tân Phú APG: đại lý cấp 1 Amadeus, xuất hóa đơn VAT, vé đoàn, vé thuyền viên, thanh toán, hoàn đổi hủy vé và các cơ sở.',
  alternates: { canonical: '/cau-hoi-thuong-gap' },
};

const FAQ = [
  {
    q: 'Tân Phú APG có phải đại lý cấp 1 không?',
    a: 'Đúng vậy. Tân Phú APG là đại lý vé máy bay cấp 1, truy cập trực tiếp hệ thống Amadeus GDS nên tra được giá và chỗ theo thời gian thực của nhiều hãng nội địa và quốc tế. Đại lý trực thuộc Hợp tác xã Vận tải Ô tô Tân Phú, mã số thuế 4600111735, hoạt động hợp pháp và xuất chứng từ đầy đủ.',
  },
  {
    q: 'Tân Phú APG có xuất hóa đơn VAT không?',
    a: 'Có. Chúng tôi xuất hóa đơn giá trị gia tăng (VAT) hợp lệ cho cá nhân và doanh nghiệp cần kê khai chi phí. Bạn chỉ cần cung cấp thông tin xuất hóa đơn ngay khi đặt vé. Chi tiết quy trình và thông tin cần chuẩn bị xem tại trang Xuất hóa đơn VAT.',
  },
  {
    q: 'Đặt vé đoàn hoặc vé thuyền viên thế nào?',
    a: 'Với đoàn từ 9 khách trở lên, chúng tôi giữ chỗ theo nhóm và báo giá riêng để tối ưu chi phí. Vé thuyền viên (seaman) được xử lý theo đúng quy định của hãng, hỗ trợ hành trình gấp và thay đổi lịch tàu. Bạn gọi hotline 0918.752.686 hoặc nhắn Zalo để được tư vấn nhanh nhất.',
  },
  {
    q: 'Thanh toán bằng cách nào?',
    a: 'Bạn có thể thanh toán bằng chuyển khoản ngân hàng hoặc các phương thức được hỗ trợ trên website khi đặt vé. Khách doanh nghiệp ký hợp đồng có thể được cấp công nợ và đối soát định kỳ. Sau khi thanh toán, vé điện tử và hóa đơn được gửi tới email hoặc Zalo của bạn.',
  },
  {
    q: 'Có hỗ trợ hoàn, đổi, hủy vé không?',
    a: 'Có. Chúng tôi hỗ trợ hoàn, đổi và hủy vé theo đúng điều kiện vé của từng hãng và hạng đặt chỗ. Mỗi loại vé có quy định phí và thời hạn khác nhau, vì vậy hãy liên hệ sớm để được kiểm tra điều kiện cụ thể. Tham khảo thêm tại trang Hoàn, đổi, hủy vé.',
  },
  {
    q: 'Tân Phú APG có những cơ sở nào?',
    a: 'Tân Phú APG có 4 cơ sở: Trụ sở chính tại Thái Nguyên (Tổ 9, Phường Tích Lương); Chi nhánh Hà Nội (323 Xuân Đỉnh); Chi nhánh Khánh Hòa (Phường Nha Trang); và Chi nhánh Phú Thọ (Phường Phúc Yên). Mọi cơ sở đều hỗ trợ đặt vé và tư vấn 24/7 qua gọi điện và Zalo.',
  },
];

const FAQ_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}).replace(/</g, '\\u003c');

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Câu hỏi thường gặp', url: '/cau-hoi-thuong-gap' },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_LD }} />
      <article className="doc">
        <h1>Câu hỏi thường gặp khi đặt vé máy bay</h1>
        <p className="doc-lead">
          Tổng hợp những thắc mắc phổ biến nhất về dịch vụ vé máy bay của Tân Phú APG — đại lý cấp 1 Amadeus GDS. Không
          tìm thấy câu trả lời? Gọi hotline 0918.752.686 hoặc nhắn Zalo, chúng tôi hỗ trợ 24/7.
        </p>

        <div className="doc-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>

        <h2>Cần thêm hướng dẫn?</h2>
        <p>
          Nếu bạn lần đầu mua vé qua website, hãy xem{' '}
          <a href="/huong-dan-dat-ve">hướng dẫn đặt vé từng bước</a> để nắm rõ quy trình tìm chuyến, giữ chỗ và thanh
          toán. Doanh nghiệp cần chứng từ kế toán có thể tham khảo trang{' '}
          <a href="/xuat-hoa-don-vat">xuất hóa đơn VAT</a>. Muốn biết thêm về đội ngũ và 4 cơ sở của chúng tôi, đọc{' '}
          <a href="/ve-chung-toi">giới thiệu về Tân Phú APG</a>.
        </p>
        <p>
          Bạn cũng có thể khám phá thêm mẹo hữu ích trong{' '}
          <a href="/cam-nang">cẩm nang du lịch &amp; hàng không</a>, chẳng hạn cách{' '}
          <a href="/cam-nang/san-ve-may-bay-gia-re-cong-tac">săn vé máy bay giá rẻ khi công tác</a> hay quy định{' '}
          <a href="/cam-nang/hanh-ly-ky-gui-xach-tay-2026">hành lý ký gửi và xách tay năm 2026</a>.
        </p>

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
      </article>
    </LandingShell>
  );
}
