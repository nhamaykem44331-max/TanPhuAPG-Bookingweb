// Danh xưng (title) hành khách — nguồn sự thật duy nhất cho cả luồng tạo PNR lẫn mặt vé.
// Người lớn: MR / MRS / MS. Trẻ em & em bé: MSTR (nam) / MISS (nữ).
//
// LỖI ĐÃ SỬA: trước đây API hold chỉ suy title từ trường `gender` (client không gửi),
// nên mọi khách nữ → MR, mọi bé gái → MSTR. Hàm này ưu tiên title thật client gửi,
// chỉ suy từ gender / mặc định khi thiếu, và LUÔN trả về title hợp lệ theo loại khách.

export type PassengerTitle = 'MR' | 'MRS' | 'MS' | 'MSTR' | 'MISS';
export type PassengerKind = 'ADT' | 'CHD' | 'INF';

export const ADULT_TITLES: readonly PassengerTitle[] = ['MR', 'MRS', 'MS'];
export const CHILD_TITLES: readonly PassengerTitle[] = ['MSTR', 'MISS'];

/** Title mặc định khi hoàn toàn không có thông tin (giữ đúng hành vi lịch sự cũ). */
export function defaultTitleForType(type: PassengerKind): PassengerTitle {
  return type === 'ADT' ? 'MR' : 'MSTR';
}

/** Title có hợp lệ với loại khách không (người lớn ≠ MSTR/MISS và ngược lại). */
export function isTitleValidForType(title: string, type: PassengerKind): title is PassengerTitle {
  const allowed = type === 'ADT' ? ADULT_TITLES : CHILD_TITLES;
  return (allowed as readonly string[]).includes(title);
}

/**
 * Suy ra title cuối cùng theo thứ tự ưu tiên:
 *   1) title thật client gửi (nếu hợp lệ với loại khách)
 *   2) suy từ gender: F → MS/MISS, M → MR/MSTR
 *   3) mặc định MR (người lớn) / MSTR (trẻ)
 * Kết quả LUÔN hợp lệ với loại khách → không bao giờ tạo ra title sai giới tính/loại.
 */
export function derivePassengerTitle(
  rawTitle: unknown,
  type: PassengerKind,
  gender?: 'M' | 'F',
): PassengerTitle {
  const candidate = String(rawTitle ?? '').trim().toUpperCase();
  if (candidate && isTitleValidForType(candidate, type)) {
    return candidate;
  }
  if (gender === 'F') return type === 'ADT' ? 'MS' : 'MISS';
  if (gender === 'M') return type === 'ADT' ? 'MR' : 'MSTR';
  return defaultTitleForType(type);
}
