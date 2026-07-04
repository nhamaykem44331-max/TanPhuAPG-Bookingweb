import type { Metadata } from 'next';
import LandingShell from '@/components/landing/LandingShell';

export const metadata: Metadata = {
  title: 'Hoàn, đổi, hủy vé máy bay | Tân Phú APG',
  description:
    'Hướng dẫn hoàn vé, đổi ngày bay và hủy vé máy bay: chính sách phụ thuộc hạng vé và quy định từng hãng. Tân Phú APG hỗ trợ xử lý tận nơi, liên hệ sớm 0918.752.686.',
  alternates: { canonical: '/hoan-doi-huy-ve' },
};

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Hoàn / đổi / hủy vé', url: '/hoan-doi-huy-ve' },
      ]}
    >
      <article className="doc">
        <h1>Hoàn, đổi và hủy vé máy bay</h1>
        <p className="doc-lead">
          Mỗi tấm vé đi kèm một bộ điều kiện riêng. Khả năng hoàn vé, đổi ngày bay hay hủy chuyến,
          cùng mức phí áp dụng, phụ thuộc vào <strong>hạng vé bạn đã mua</strong> và{' '}
          <strong>quy định của từng hãng hàng không</strong>. Tân Phú APG giúp bạn tra cứu điều kiện
          chính xác và xử lý mọi thủ tục tận nơi.
        </p>

        <h2>Đổi ngày bay, hoàn vé và hủy vé khác nhau thế nào?</h2>
        <p>
          Ba thao tác này thường bị nhầm lẫn nhưng có quy trình và chi phí khác nhau:
        </p>
        <ul>
          <li>
            <strong>Đổi ngày bay (đổi vé):</strong> giữ nguyên hành trình nhưng thay đổi ngày, giờ
            hoặc chuyến bay. Thường phát sinh phí đổi và phần chênh lệch giá vé nếu chặng mới đắt
            hơn. Đây là lựa chọn linh hoạt nhất khi kế hoạch thay đổi.
          </li>
          <li>
            <strong>Hoàn vé:</strong> trả lại vé chưa sử dụng để nhận lại một phần giá trị. Số tiền
            hoàn lại tùy điều kiện vé — nhiều vé giá rẻ chỉ hoàn thuế/phí, trong khi vé hạng linh
            hoạt có thể hoàn phần lớn giá trị.
          </li>
          <li>
            <strong>Hủy vé:</strong> chấm dứt hành trình, thường đi cùng yêu cầu hoàn (nếu vé cho
            phép) hoặc bảo lưu giá trị. Một số loại vé khuyến mãi không cho phép hoàn hoặc hủy.
          </li>
        </ul>

        <h2>Phí và thời hạn cần lưu ý</h2>
        <p>
          Vì điều kiện thay đổi theo từng hạng đặt chỗ, chúng tôi <strong>không cam kết một con số
          phí cố định</strong>. Tuy nhiên, có vài nguyên tắc chung đáng ghi nhớ:
        </p>
        <ul>
          <li>
            Vé càng rẻ thường càng nhiều ràng buộc; vé hạng cao linh hoạt hơn về đổi và hoàn.
          </li>
          <li>
            Mức phí và phần giá trị được hoàn phụ thuộc thời điểm yêu cầu so với giờ khởi hành — xử
            lý càng sớm, càng nhiều lựa chọn và chi phí thường thấp hơn.
          </li>
          <li>
            Đa số hãng yêu cầu thực hiện <strong>trước giờ bay</strong>; vé đã quá hạn (no-show)
            thường mất phần lớn hoặc toàn bộ giá trị.
          </li>
          <li>
            Một số trường hợp bất khả kháng (hãng đổi/hủy chuyến, lý do y tế có chứng từ) có thể được
            áp dụng chính sách riêng — hãy giữ lại giấy tờ liên quan.
          </li>
        </ul>

        <h2>Tân Phú APG xử lý giúp bạn</h2>
        <p>
          Là đại lý vé máy bay <strong>cấp 1</strong> truy cập trực tiếp hệ thống Amadeus GDS, Tân
          Phú APG tra cứu được điều kiện vé thực tế của từng đặt chỗ và thay mặt bạn làm việc với
          hãng để đổi, hoàn hoặc hủy. Bạn không phải tự liên hệ tổng đài hay xếp hàng chờ — chúng tôi
          xử lý tận nơi và báo rõ chi phí trước khi thực hiện. Để hiểu thêm các tình huống thường
          gặp, bạn có thể xem{' '}
          <a href="/cau-hoi-thuong-gap">các câu hỏi thường gặp về vé máy bay</a> hoặc tham khảo{' '}
          <a href="/huong-dan-dat-ve">hướng dẫn đặt vé trên website</a>.
        </p>
        <p>
          Khi cần thay đổi lịch trình, hãy <strong>liên hệ càng sớm càng tốt</strong>: thông tin
          chuyến bay, mã đặt chỗ và yêu cầu cụ thể giúp chúng tôi tìm phương án tối ưu nhất. Đội ngũ
          hỗ trợ 24/7 qua điện thoại và Zalo luôn sẵn sàng. Nếu chưa có vé, bạn có thể{' '}
          <a href="/dat-ve">tìm và so sánh chuyến bay</a> ngay trên trang đặt vé.
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
