import { redirect } from "next/navigation";

// Trang danh sách markup đã hợp nhất vào /admin/markup (thiết kế mới, có đủ Tạo/Sửa/Bật-Tắt/Xóa).
// Giữ route này chỉ để chuyển hướng cho link/bookmark cũ; form tạo/sửa vẫn ở các route con.
export default function MarkupRulesListRedirect() {
  redirect("/admin/markup");
}
