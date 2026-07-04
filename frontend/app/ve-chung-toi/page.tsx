import type { Metadata } from 'next';
import LandingShell from '@/components/landing/LandingShell';

export const metadata: Metadata = {
  title: 'Về chúng tôi - Tân Phú APG | Đại lý vé máy bay cấp 1',
  description:
    'Tân Phú APG là đại lý vé máy bay cấp 1, truy cập trực tiếp hệ thống Amadeus GDS, thuộc HTX Vận tải Ô tô Tân Phú. Vé nội địa, quốc tế, vé đoàn, thuyền viên, hỗ trợ 24/7.',
  alternates: { canonical: '/ve-chung-toi' },
};

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Về chúng tôi', url: '/ve-chung-toi' },
      ]}
    >
      <article className="doc">
        <h1>Về Tân Phú APG - Đại lý vé máy bay cấp 1</h1>
        <p className="doc-lead">
          Tân Phú APG là đại lý vé máy bay <strong>cấp 1</strong>, truy cập trực tiếp hệ thống Amadeus GDS để xuất vé nội
          địa và quốc tế. Chúng tôi trực thuộc <strong>Hợp tác xã Vận tải Ô tô Tân Phú</strong>, hoạt động minh bạch với
          mã số thuế <strong>4600111735</strong>.
        </p>

        <h2>Đại lý cấp 1 nghĩa là gì?</h2>
        <p>
          Là đại lý cấp 1, Tân Phú APG kết nối <strong>trực tiếp vào hệ thống phân phối toàn cầu Amadeus (GDS)</strong>,
          nơi tổng hợp giá và chỗ trống từ các hãng hàng không trong nước và quốc tế theo thời gian thực. Nhờ truy cập
          trực tiếp, chúng tôi chủ động kiểm tra hành trình, giữ chỗ và xuất vé ngay mà không phải qua trung gian - giúp
          giá minh bạch và xử lý nhanh hơn. Bạn có thể tự tra cứu chuyến bay tại{' '}
          <a href="/dat-ve">trang tìm vé máy bay</a> hoặc xem trước{' '}
          <a href="/huong-dan-dat-ve">hướng dẫn đặt vé từng bước</a>.
        </p>

        <h2>Dịch vụ của chúng tôi</h2>
        <ul>
          <li>
            <strong>Vé máy bay nội địa và quốc tế</strong> của các hãng hàng không trong nước và quốc tế.
          </li>
          <li>
            <strong>Vé đoàn từ 9 khách trở lên</strong>, báo giá và giữ chỗ riêng cho nhóm, công ty, sự kiện.
          </li>
          <li>
            <strong>Vé thuyền viên</strong> với chính sách và thủ tục chuyên biệt - xem thêm{' '}
            <a href="/cam-nang/ve-may-bay-thuyen-vien">cẩm nang vé máy bay thuyền viên</a>.
          </li>
          <li>
            <strong>Khách doanh nghiệp</strong>: hỗ trợ thanh toán công nợ và{' '}
            <a href="/xuat-hoa-don-vat">xuất hóa đơn VAT</a> đầy đủ.
          </li>
          <li>
            <strong>Du học và xuất khẩu lao động</strong>: tư vấn lộ trình, hành lý và thời điểm bay phù hợp.
          </li>
          <li>
            <strong>Hỗ trợ hoàn, đổi, hủy vé</strong> theo điều kiện vé - chi tiết tại{' '}
            <a href="/hoan-doi-huy-ve">trang hoàn, đổi, hủy vé</a>.
          </li>
        </ul>

        <h2>Hệ thống 4 cơ sở</h2>
        <p>Tân Phú APG phục vụ khách hàng tại bốn cơ sở trên cả nước:</p>
        <ul>
          <li>
            <strong>Trụ sở chính Thái Nguyên</strong>: Tổ 9, Phường Tích Lương.
          </li>
          <li>
            <strong>Chi nhánh Hà Nội</strong>: 323 Xuân Đỉnh.
          </li>
          <li>
            <strong>Chi nhánh Khánh Hòa</strong>: Phường Nha Trang.
          </li>
          <li>
            <strong>Chi nhánh Phú Thọ</strong>: Phường Phúc Yên.
          </li>
        </ul>

        <h2>Cam kết của chúng tôi</h2>
        <p>
          Mỗi đơn hàng đều được nhân viên <strong>theo sát từng bước</strong>, từ lúc tư vấn hành trình đến khi xuất vé
          và sau bán. Đội ngũ <strong>hỗ trợ 24/7</strong> qua gọi điện và Zalo luôn sẵn sàng xử lý đổi giờ bay, giữ chỗ
          gấp hay giải đáp thắc mắc. Nếu còn băn khoăn, mời bạn tham khảo{' '}
          <a href="/cau-hoi-thuong-gap">câu hỏi thường gặp</a>, đọc thêm các bài viết trong{' '}
          <a href="/cam-nang">cẩm nang du lịch và đặt vé</a>, hoặc tìm hiểu mẹo{' '}
          <a href="/cam-nang/san-ve-may-bay-gia-re-cong-tac">săn vé máy bay giá rẻ cho chuyến công tác</a>.
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
