import type { TicketLeg, TicketPassenger, TicketPriceLines, TicketHoldData, TicketPaidData, TicketQuoteData } from '@/components/ticket/TicketFace';

// Dữ liệu mẫu dùng cho /ticket/preview để duyệt visual 3 trạng thái trước khi nối vào /dat-ve, /dat-cho, payment.
export const SAMPLE_LEGS: TicketLeg[] = [
  {
    direction: 'outbound',
    weekday: 'Thứ 3',
    dateLabel: '23/06',
    airlineCode: 'VJ',
    airline: 'Vietjet Air',
    flightNumber: 'VJ161',
    aircraft: 'A321',
    fareClass: 'Phổ thông',
    baggageChecked: '20kg ký gửi',
    baggageCarryOn: '7kg xách tay',
    stopsLabel: 'Bay thẳng',
    durationLabel: '2g 10m',
    depTime: '20:55',
    arrTime: '23:05',
    depCity: 'Hà Nội',
    arrCity: 'TP. Hồ Chí Minh',
    depCode: 'HAN',
    arrCode: 'SGN',
    depAirport: 'Nội Bài (T1)',
    arrAirport: 'Tân Sơn Nhất (T1)',
  },
  {
    direction: 'return',
    weekday: 'Thứ 7',
    dateLabel: '27/06',
    airlineCode: 'VN',
    airline: 'Vietnam Airlines',
    flightNumber: 'VN246',
    aircraft: 'A350',
    fareClass: 'Phổ thông',
    baggageChecked: '23kg ký gửi',
    baggageCarryOn: '7kg xách tay',
    stopsLabel: 'Bay thẳng',
    durationLabel: '2g 10m',
    depTime: '18:00',
    arrTime: '20:10',
    depCity: 'TP. Hồ Chí Minh',
    arrCity: 'Hà Nội',
    depCode: 'SGN',
    arrCode: 'HAN',
    depAirport: 'Tân Sơn Nhất (T1)',
    arrAirport: 'Nội Bài (T1)',
  },
];

export const SAMPLE_PASSENGERS: TicketPassenger[] = [
  { index: 1, title: 'MR', fullName: 'NGUYEN VAN AN', ticketNumber: '738-2401234567' },
  { index: 2, title: 'MS', fullName: 'TRAN THI BICH', ticketNumber: '738-2401234568' },
];

export const SAMPLE_PRICE: TicketPriceLines = {
  baseFare: 3_910_000,
  taxesAndFees: 312_800,
  total: 4_222_800,
  segmentsLabel: '2 chặng',
};

export const SAMPLE_QUOTE: TicketQuoteData = {
  validUntilLabel: '17:30 24/06/2026',
};

// VietQR demo (sandbox cho phép load qua https). Bản thật sẽ lấy từ intent.qrCode của SePay.
const SAMPLE_QR = 'https://img.vietqr.io/image/BIDV-96247558868-compact2.png?amount=4222800&addInfo=APGVKA91';

export const SAMPLE_HOLD: TicketHoldData = {
  amountDue: 4_222_800,
  bankCode: 'BIDV',
  bankAccount: '96247 558 868',
  bankAccountName: 'TRAN THI HONG',
  transferContent: 'APGVKA91',
  qrImageUrl: SAMPLE_QR,
  deadlineLabel: '17:30 ngày 24/06',
  countdownLabel: '02:58:12',
};

export const SAMPLE_PAID: TicketPaidData = {
  totalPaid: 4_222_800,
  paidAtLabel: '23/06/2026 16:42',
  issuedDateLabel: '23/06/2026',
};

export const SAMPLE_REFERENCE = {
  quote: 'APG-7K2F9D',
  hold: 'APGVKA91',
  paid: 'APGVKA91',
};
