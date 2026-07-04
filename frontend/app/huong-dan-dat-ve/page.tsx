import type { Metadata } from 'next';
import LandingShell from '@/components/landing/LandingShell';

export const metadata: Metadata = {
  title: 'Hướng dẫn đặt vé máy bay online | Tân Phú APG',
  description:
    'Hướng dẫn đặt vé máy bay nội địa & quốc tế tại Tân Phú APG: tìm chuyến, so sánh giá nhiều hãng, giữ chỗ tạo PNR, thanh toán chuyển khoản/QR, nhận vé điện tử và hóa đơn VAT.',
  alternates: { canonical: '/huong-dan-dat-ve' },
};

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Hướng dẫn đặt vé', url: '/huong-dan-dat-ve' },
      ]}
    >
      <article className="doc">
        <h1>Hướng dẫn đặt vé máy bay tại Tân Phú APG</h1>
        <p className="doc-lead">
          Tân Phú APG là đại lý vé máy bay <strong>cấp 1</strong>, truy cập trực tiếp hệ thống Amadeus GDS, giúp bạn
          tra cứu giá thật của hầu hết các hãng và đặt vé nhanh chỉ trong vài phút. Dưới đây là 6 bước đặt vé từ
          khâu tìm chuyến đến khi nhận vé điện tử và hóa đơn VAT.
        </p>

        <h2>6 bước đặt vé máy bay online</h2>
        <ol>
          <li>
            <strong>Tìm chuyến bay.</strong> Truy cập{' '}
            <a href="/dat-ve">trang tìm vé máy bay</a> của chúng tôi, chọn điểm đi và điểm đến, ngày khởi hành (và
            ngày về nếu khứ hồi), cùng số lượng khách theo từng nhóm tuổi (người lớn, trẻ em, em bé).
          </li>
          <li>
            <strong>So sánh giá nhiều hãng.</strong> Hệ thống hiển thị đồng thời kết quả từ nhiều hãng hàng không.
            Bạn dễ dàng so sánh giá vé, giờ bay, thời gian nối chuyến và điều kiện hành lý để chọn phương án tối ưu.
          </li>
          <li>
            <strong>Chọn vé &amp; xem báo giá.</strong> Sau khi chọn chuyến phù hợp, bạn sẽ thấy báo giá đầy đủ gồm
            giá vé, thuế, phí và tổng tiền cần thanh toán — minh bạch, không phát sinh chi phí ẩn.
          </li>
          <li>
            <strong>Giữ chỗ (hold) / tạo PNR.</strong> Cung cấp họ tên (đúng theo giấy tờ tùy thân/hộ chiếu) và số
            điện thoại liên hệ. Chúng tôi tạo mã đặt chỗ PNR và giữ chỗ cho bạn trong thời hạn cho phép của hãng.
          </li>
          <li>
            <strong>Thanh toán.</strong> Hoàn tất thanh toán bằng chuyển khoản ngân hàng hoặc quét mã QR. Vui lòng
            thanh toán trước thời hạn giữ chỗ để vé không bị hủy tự động và giá không thay đổi theo hệ thống.
          </li>
          <li>
            <strong>Nhận vé điện tử &amp; hóa đơn VAT.</strong> Ngay sau khi xác nhận thanh toán, chúng tôi xuất vé
            và gửi vé điện tử (e-ticket) qua email/Zalo. Cần hóa đơn đỏ, xem{' '}
            <a href="/xuat-hoa-don-vat">hướng dẫn xuất hóa đơn VAT</a> để được hỗ trợ.
          </li>
        </ol>

        <h2>Lưu ý quan trọng khi đặt vé</h2>
        <ul>
          <li>
            <strong>Kiểm tra kỹ thông tin hành khách</strong> trước khi tạo PNR. Họ tên sai chính tả có thể phát
            sinh phí đổi tên hoặc không lên được máy bay; xem thêm{' '}
            <a href="/cau-hoi-thuong-gap">câu hỏi thường gặp</a> về quy định này.
          </li>
          <li>
            Mỗi hạng vé có điều kiện riêng về đổi/hủy và hoàn tiền. Trước khi thanh toán, hãy đọc{' '}
            <a href="/hoan-doi-huy-ve">chính sách hoàn, đổi, hủy vé</a> để chủ động cho kế hoạch của mình.
          </li>
          <li>
            Với vé quốc tế, kiểm tra hộ chiếu còn hạn, thị thực (visa) và yêu cầu nhập cảnh của nước đến. Mẹo săn vé
            tiết kiệm có trong bài{' '}
            <a href="/cam-nang/san-ve-may-bay-gia-re-cong-tac">săn vé máy bay giá rẻ cho công tác</a>.
          </li>
        </ul>

        <h2>Vé đoàn, vé thuyền viên &amp; khách doanh nghiệp</h2>
        <p>
          Với <strong>vé đoàn từ 9 khách trở lên</strong>, <strong>vé thuyền viên</strong>, vé du học &amp; xuất khẩu
          lao động, hoặc khách doanh nghiệp cần xuất vé theo công nợ, vui lòng liên hệ hotline{' '}
          <strong>0918.752.686</strong> (hỗ trợ 24/7 qua điện thoại và Zalo) để được báo giá riêng và giữ chỗ ưu tiên
          thay vì đặt trực tiếp trên website. Tìm hiểu thêm về năng lực đại lý cấp 1 tại trang{' '}
          <a href="/ve-chung-toi">về chúng tôi</a>.
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
