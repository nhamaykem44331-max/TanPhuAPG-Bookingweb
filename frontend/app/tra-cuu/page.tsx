import LookupClient from "./LookupClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chuyến bay của tôi - Tân Phú APG",
  description: "Xem chuyến bay của bạn: trạng thái đặt chỗ, tải mặt vé và thanh toán tiếp bằng mã đơn và số điện thoại.",
  alternates: { canonical: "/tra-cuu" },
  robots: { index: false, follow: false },
};

export default function TraCuuPage() {
  return <LookupClient />;
}
