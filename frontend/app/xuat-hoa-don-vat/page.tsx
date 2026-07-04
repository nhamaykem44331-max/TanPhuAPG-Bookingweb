import type { Metadata } from 'next';
import LandingShell from '@/components/landing/LandingShell';

export const metadata: Metadata = {
  title: 'Xuất hóa đơn VAT vé máy bay | Tân Phú APG',
  description:
    'Tân Phú APG xuất hóa đơn VAT (GTGT) đầy đủ cho vé máy bay nội địa & quốc tế, gửi hóa đơn điện tử qua email. Phù hợp doanh nghiệp công nợ, quyết toán chi phí đi lại theo kỳ.',
  alternates: { canonical: '/xuat-hoa-don-vat' },
};

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Xuất hóa đơn VAT', url: '/xuat-hoa-don-vat' },
      ]}
    >
      <article className="doc">
        <h1>Xuất hóa đơn VAT vé máy bay</h1>
        <p className="doc-lead">
          Tân Phú APG xuất hóa đơn VAT (giá trị gia tăng) đầy đủ, hợp lệ cho mọi vé máy bay nội địa và quốc tế đặt qua
          chúng tôi. Hóa đơn được lập đúng quy định và gửi tới email của bạn, sẵn sàng để hạch toán và quyết toán chi phí.
        </p>

        <h2>Hóa đơn VAT cho cả vé nội địa & quốc tế</h2>
        <p>
          Là <strong>đại lý vé máy bay cấp 1</strong> truy cập trực tiếp hệ thống Amadeus GDS, Tân Phú APG xuất hóa đơn
          VAT cho vé của tất cả các hãng hàng không trong nước và quốc tế. Mọi giao dịch đều có chứng từ rõ ràng, giúp cá
          nhân và doanh nghiệp yên tâm khi cần hồ sơ thanh toán hợp lệ.
        </p>

        <h2>Giải pháp cho khách hàng doanh nghiệp</h2>
        <p>
          Với các công ty thường xuyên cử nhân sự đi công tác, chúng tôi hỗ trợ hình thức{' '}
          <strong>công nợ</strong> và tổng hợp <strong>báo cáo chi phí đi lại theo kỳ</strong> (tuần, tháng, quý). Doanh
          nghiệp đặt vé trước, đối soát và thanh toán theo chu kỳ đã thỏa thuận, giảm tải khâu kế toán và tránh thanh toán
          lẻ tẻ từng vé. Tìm hiểu thêm về năng lực và các cơ sở của chúng tôi tại trang{' '}
          <a href="/ve-chung-toi">giới thiệu Tân Phú APG</a>.
        </p>

        <h2>Thông tin cần cung cấp để xuất hóa đơn</h2>
        <p>Để hóa đơn VAT chính xác và hợp lệ, vui lòng gửi đầy đủ các thông tin sau:</p>
        <ul>
          <li>
            <strong>Tên công ty / đơn vị</strong> đúng theo đăng ký kinh doanh.
          </li>
          <li>
            <strong>Mã số thuế (MST)</strong> của đơn vị mua hàng.
          </li>
          <li>
            <strong>Địa chỉ</strong> đăng ký của công ty trên giấy phép.
          </li>
          <li>
            <strong>Email nhận hóa đơn</strong> để chúng tôi gửi hóa đơn điện tử.
          </li>
        </ul>
        <p>
          Với hóa đơn xuất cho cá nhân, bạn chỉ cần cung cấp họ tên và email nhận hóa đơn. Bạn nên gửi thông tin xuất hóa
          đơn ngay tại bước đặt vé để tránh sai sót; xem chi tiết quy trình trong{' '}
          <a href="/huong-dan-dat-ve">hướng dẫn đặt vé từng bước</a>.
        </p>

        <h2>Thời điểm & cách nhận hóa đơn điện tử</h2>
        <p>
          Tân Phú APG sử dụng <strong>hóa đơn điện tử</strong> theo quy định hiện hành. Sau khi vé đã được xuất và thanh
          toán hoàn tất, hóa đơn VAT sẽ được lập và gửi vào <strong>email</strong> bạn cung cấp, kèm liên kết tra cứu trên
          hệ thống hóa đơn điện tử. Nếu cần gộp nhiều vé trong kỳ vào một bảng kê, hoặc cần hỗ trợ điều chỉnh thông tin,
          vui lòng liên hệ hotline để được xử lý nhanh.
        </p>

        <h2>Hỗ trợ 24/7</h2>
        <p>
          Mọi thắc mắc về hóa đơn, công nợ hay chứng từ đều được đội ngũ Tân Phú APG hỗ trợ <strong>24/7</strong> qua điện
          thoại và Zalo theo số hotline <strong>0918.752.686</strong>. Mã số thuế đại lý:{' '}
          <strong>4600111735</strong>.
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
