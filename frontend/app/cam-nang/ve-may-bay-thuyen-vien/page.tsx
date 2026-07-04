import type { Metadata } from 'next';
import LandingShell from '@/components/landing/LandingShell';

export const metadata: Metadata = {
  title: 'Vé máy bay cho thuyền viên: giấy tờ cần chuẩn bị | Tân Phú APG',
  description:
    'Vé máy bay thuyền viên (seaman fare) là gì, lợi ích và giấy tờ thường cần: hộ chiếu, sổ thuyền viên, hợp đồng SEA, thư mời lên tàu. Tân Phú APG hỗ trợ 24/7.',
  alternates: { canonical: '/cam-nang/ve-may-bay-thuyen-vien' },
};

export default function Page() {
  return (
    <LandingShell
      breadcrumb={[
        { name: 'Trang chủ', url: '/' },
        { name: 'Cẩm nang', url: '/cam-nang' },
        { name: 'Vé máy bay cho thuyền viên: giấy tờ cần chuẩn bị', url: '/cam-nang/ve-may-bay-thuyen-vien' },
      ]}
    >
      <article className="doc">
        <h1>Vé máy bay cho thuyền viên: giấy tờ cần chuẩn bị</h1>
        <p className="doc-meta">Cập nhật 05/06/2026</p>
        <p className="doc-lead">
          Thuyền viên đi nhận tàu hoặc hồi hương thường được hưởng loại vé riêng với điều kiện linh hoạt hơn vé phổ
          thông. Bài viết tổng hợp giấy tờ thường cần và những lưu ý khi lịch tàu thay đổi.
        </p>

        <h2>Vé thuyền viên (seaman fare) là gì?</h2>
        <p>
          Vé thuyền viên (tiếng Anh là <strong>seaman fare</strong> hoặc <strong>marine fare</strong>) là loại giá vé
          ưu đãi mà nhiều hãng hàng không dành riêng cho thuyền viên đi làm nhiệm vụ trên tàu biển. So với vé thông
          thường, vé thuyền viên thường có những lợi ích sau:
        </p>
        <ul>
          <li>
            <strong>Tiêu chuẩn hành lý ký gửi cao hơn</strong> để mang theo đồ nghề và tư trang cho chuyến đi biển dài
            ngày (mức cụ thể tùy hãng và tuyến).
          </li>
          <li>
            <strong>Điều kiện đổi lịch linh hoạt hơn</strong>, phù hợp với đặc thù lịch tàu có thể thay đổi sát ngày.
          </li>
          <li>
            <strong>Mức giá ưu đãi</strong> cho hành trình nhận tàu, chuyển tàu hoặc hồi hương.
          </li>
        </ul>
        <p>
          Vì điều kiện áp dụng khác nhau giữa các hãng, bạn nên xác nhận trước khi xuất vé. Tham khảo thêm bài{' '}
          <a href="/cam-nang/hanh-ly-ky-gui-xach-tay-2026">quy định hành lý ký gửi và xách tay 2026</a> để chuẩn bị
          hành lý đúng tiêu chuẩn.
        </p>

        <h2>Giấy tờ thường cần chuẩn bị</h2>
        <p>
          Yêu cầu chứng từ <strong>tùy theo hãng và tuyến bay</strong>, nhưng phần lớn trường hợp sẽ cần đến các giấy
          tờ dưới đây:
        </p>
        <ul>
          <li>
            <strong>Hộ chiếu</strong> còn hạn và <strong>sổ thuyền viên (Seaman’s Book / SID)</strong>.
          </li>
          <li>
            <strong>Hợp đồng lao động thuyền viên (SEA - Seafarer’s Employment Agreement)</strong> hoặc hợp đồng làm
            việc với chủ tàu/công ty quản lý thuyền viên.
          </li>
          <li>
            <strong>Thư mời lên tàu (letter of guarantee / letter of invitation)</strong> hoặc văn bản tương đương từ
            chủ tàu hoặc đại lý — yêu cầu này tùy hãng và tuyến.
          </li>
          <li>Visa quá cảnh/nhập cảnh nếu hành trình đi qua hoặc đến quốc gia có yêu cầu.</li>
        </ul>
        <p>
          Bạn nên gửi trước bản scan các giấy tờ để chúng tôi kiểm tra tính hợp lệ với điều kiện vé của từng hãng,
          tránh phát sinh khi làm thủ tục tại sân bay.
        </p>

        <h2>Lưu ý khi lịch tàu thay đổi</h2>
        <p>
          Lịch nhận tàu, chuyển tàu hay rời tàu có thể thay đổi do thời tiết, kế hoạch cập cảng hoặc điều động của chủ
          tàu. Khi đó, việc đổi ngày bay cần được xử lý nhanh và đúng điều kiện vé. Hãy báo cho chúng tôi sớm nhất có
          thể để giữ được chỗ tốt và hạn chế chênh lệch giá. Một số điều kiện đổi, hoàn áp dụng theo quy định của hãng —
          tham khảo thêm <a href="/hoan-doi-huy-ve">hướng dẫn hoàn, đổi và hủy vé</a> để nắm rõ.
        </p>

        <h2>Tân Phú APG hỗ trợ thuyền viên thế nào?</h2>
        <p>
          Là đại lý vé máy bay <strong>cấp 1</strong> truy cập trực tiếp hệ thống <strong>Amadeus GDS</strong>, Tân Phú
          APG xử lý vé thuyền viên cho cả chặng nội địa và quốc tế. Chúng tôi tư vấn loại giá phù hợp, kiểm tra giấy tờ
          theo yêu cầu của từng hãng, <strong>linh hoạt đổi lịch</strong> khi lịch tàu thay đổi và hỗ trợ{' '}
          <strong>24/7 qua điện thoại và Zalo</strong>. Doanh nghiệp quản lý thuyền viên có thể đặt vé theo hình thức
          công nợ và <a href="/xuat-hoa-don-vat">xuất hóa đơn VAT</a> đầy đủ.
        </p>
        <p>
          Bạn có thể tự <a href="/dat-ve">tra cứu và đặt vé trực tuyến</a>, xem trước{' '}
          <a href="/huong-dan-dat-ve">hướng dẫn các bước đặt vé</a>, hoặc gọi hotline để được đội ngũ hỗ trợ trực tiếp.
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
