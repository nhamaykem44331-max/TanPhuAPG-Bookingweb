import type { Metadata } from 'next';
import LandingShell from '@/components/landing/LandingShell';

export const metadata: Metadata = {
  title: 'Hành lý ký gửi và xách tay: quy định mới nhất 2026 | Tân Phú APG',
  description:
    'Phân biệt hành lý xách tay và ký gửi, lưu ý mức cân và kích thước tùy hãng, vật phẩm hạn chế và mẹo tránh phụ thu hành lý khi đặt vé máy bay năm 2026.',
  alternates: { canonical: '/cam-nang/hanh-ly-ky-gui-xach-tay-2026' },
};

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Cẩm nang', url: '/cam-nang' },
        { name: 'Hành lý ký gửi và xách tay: quy định mới nhất 2026', url: '/cam-nang/hanh-ly-ky-gui-xach-tay-2026' },
      ]}
    >
      <article className="doc">
        <h1>Hành lý ký gửi và xách tay: quy định mới nhất 2026</h1>
        <p className="doc-meta">Cập nhật 12/06/2026</p>
        <p className="doc-lead">
          Hiểu rõ sự khác biệt giữa hành lý xách tay và hành lý ký gửi giúp bạn đóng gói gọn gàng, tránh bị từ chối tại cửa
          khởi hành và không tốn thêm phụ thu đắt đỏ ở sân bay. Dưới đây là những điểm cốt lõi bạn cần nắm trước mỗi chuyến bay.
        </p>

        <h2>Hành lý xách tay là gì?</h2>
        <p>
          Hành lý xách tay là phần hành lý bạn mang theo lên khoang máy bay và tự bảo quản trong suốt hành trình. Thông thường
          mỗi khách được mang <strong>một kiện chính</strong> đặt trên hộc hành lý phía trên đầu cùng <strong>một vật dụng
          nhỏ</strong> (túi xách, balo laptop) để dưới ghế trước. Mức cân tối đa và kích thước ba chiều của kiện xách tay
          <strong> thay đổi tùy hãng và hạng vé</strong> nên bạn hãy kiểm tra trực tiếp khi đặt vé thay vì áng chừng.
        </p>

        <h2>Hành lý ký gửi là gì?</h2>
        <p>
          Hành lý ký gửi là phần bạn gửi tại quầy thủ tục và nhận lại ở băng chuyền nơi đến. Vé phổ thông giá rẻ thường
          <strong> không kèm sẵn ký gửi</strong>, trong khi nhiều hạng vé cao hơn đã bao gồm một mức nhất định. Số kiện, trọng
          lượng cho phép và quy cách đóng gói cũng <strong>phụ thuộc vào hãng bay và hạng vé</strong> — đây là lý do bạn nên xác
          nhận hạn mức ngay tại bước chọn vé. Nếu chưa quen thao tác, tham khảo{' '}
          <a href="/huong-dan-dat-ve">hướng dẫn đặt vé máy bay chi tiết</a> để biết nơi xem và thêm hành lý.
        </p>

        <h2>Vật phẩm hạn chế và cấm mang</h2>
        <p>Một số nguyên tắc an toàn áp dụng chung trên hầu hết các hãng:</p>
        <ul>
          <li>
            <strong>Chất lỏng trong hành lý xách tay</strong> chỉ được mang theo dạng chai dung tích nhỏ, đựng trong túi nilon
            trong suốt có khóa kéo.
          </li>
          <li>
            <strong>Pin sạc dự phòng và pin lithium</strong> phải để ở hành lý xách tay, tuyệt đối không ký gửi dưới khoang hàng.
          </li>
          <li>
            <strong>Vật sắc nhọn, dao kéo, chất dễ cháy nổ</strong> không được mang lên khoang; một số mặt hàng chỉ được ký gửi
            có điều kiện.
          </li>
          <li>
            <strong>Thuốc men, đồ điện tử giá trị, giấy tờ tùy thân</strong> nên để trong hành lý xách tay để chủ động bảo quản.
          </li>
        </ul>

        <h2>Mẹo tránh phụ thu hành lý</h2>
        <p>
          Phụ thu hành lý mua ngay tại sân bay thường <strong>đắt hơn đáng kể</strong> so với mua trước online. Vì vậy hãy:
        </p>
        <ul>
          <li>Ước lượng số ký cần dùng và <strong>mua thêm gói ký gửi online</strong> ngay khi đặt vé hoặc trước giờ bay.</li>
          <li>Cân thử hành lý ở nhà để tránh vượt mức và phải trả phí phát sinh tại quầy.</li>
          <li>Tận dụng tối đa định mức xách tay nhưng vẫn tuân thủ giới hạn để không bị buộc ký gửi tại cửa.</li>
        </ul>
        <p>
          Khi bạn <a href="/dat-ve">tìm và đặt vé máy bay trực tuyến</a> tại Tân Phú APG, hệ thống hiển thị rõ điều kiện hành lý
          theo từng hạng vé để bạn so sánh trước khi quyết định. Cần tư vấn vé đoàn, vé thuyền viên hay vé doanh nghiệp, đội ngũ
          của chúng tôi hỗ trợ 24/7 qua điện thoại và Zalo. Bạn cũng có thể xem thêm các bài viết trong{' '}
          <a href="/cam-nang">cẩm nang đặt vé máy bay</a> hoặc tra cứu nhanh tại{' '}
          <a href="/cau-hoi-thuong-gap">câu hỏi thường gặp</a>.
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
