import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFlightLegSummaries, buildPassengerSummaries, passengerLines } from "./flightSummary";
import { renderBookingHold } from "./templates/bookingHold";
import { renderPaymentReceived } from "./templates/paymentReceived";

// Dựng booking giống đơn thật APG-260707-D56624: giờ lưu là INSTANT thật (22:45Z = 05:45 hôm sau VN).
const booking = {
  namthanhRawJson: {
    itinerary: {
      legs: [
        {
          direction: "outbound",
          route: "HAN-CXR",
          airline: "Vietjet Air",
          airlineCode: "VJ",
          departAt: "2026-07-13T22:45:00.000Z",
          arrivalAt: "2026-07-14T00:35:00.000Z",
          segments: [
            {
              carrierCode: "VJ",
              flightNumber: "VJ1775",
              from: "HAN",
              to: "CXR",
              departAt: "2026-07-13T22:45:00.000Z",
              arrivalAt: "2026-07-14T00:35:00.000Z",
            },
          ],
        },
      ],
    },
    request: {
      passengers: [
        { type: "ADT", lastName: "NGUYEN", firstName: "TO HOAN" },
        { type: "ADT", lastName: "NGUYEN", firstName: "TO ANH" },
        { type: "ADT", lastName: "NGUYEN", firstName: "PHUONG THAO" },
      ],
    },
  },
  routeSummary: "HAN-CXR",
  airline: "VJ",
  cabin: "economy",
  departAt: new Date("2026-07-13T22:45:00.000Z"),
  returnAt: null,
};

test("TIMEZONE: giờ bay hiển thị theo giờ VN (05:45 14/07), KHÔNG phải UTC (22:45 13/07)", () => {
  const legs = buildFlightLegSummaries(booking);
  assert.equal(legs.length, 1);
  assert.equal(legs[0].departTime, "05:45"); // 22:45Z + 7h
  assert.equal(legs[0].arriveTime, "07:35");
  assert.equal(legs[0].dateLabel, "14/07/2026"); // qua ngày mới
  assert.equal(legs[0].route, "HAN → CXR");
  assert.equal(legs[0].flightNumber, "VJ1775");
});

test("HÀNH KHÁCH: liệt kê đủ 3 người, không chỉ người đặt", () => {
  const pax = buildPassengerSummaries(booking);
  assert.equal(pax.length, 3);
  const lines = passengerLines(pax);
  assert.equal(lines[0], "1. NGUYEN TO HOAN — Người lớn");
  assert.equal(lines[1], "2. NGUYEN TO ANH — Người lớn");
  assert.equal(lines[2], "3. NGUYEN PHUONG THAO — Người lớn");
});

test("EMAIL giữ chỗ: có đủ 3 hành khách + giờ VN + tổng tiền đúng", () => {
  const legs = buildFlightLegSummaries(booking);
  const pax = buildPassengerSummaries(booking);
  const email = renderBookingHold({
    orderCode: "APG-260707-D56624",
    customerName: "NGUYEN TO HOAN",
    customerEmail: "x@y.com",
    pnr: "5M658W",
    route: "HAN-CXR",
    departAt: "14/07/2026 05:45",
    flightLegs: legs,
    passengers: pax,
    passengerCount: 3,
    sellAmount: "4.202.343",
    currency: "VND",
    ttlExpiresAt: "19:35 07/07/2026",
    paymentDue: "4.202.343",
  });
  assert.match(email.html, /NGUYEN TO ANH/);
  assert.match(email.html, /NGUYEN PHUONG THAO/);
  assert.match(email.html, /05:45/);
  assert.match(email.html, /4\.202\.343/);
  assert.match(email.text, /NGUYEN PHUONG THAO/);
  assert.doesNotMatch(email.html, /22:45/); // không được lộ giờ UTC
});

test("EMAIL đã thanh toán: đúng số tiền + PNR + giờ VN", () => {
  const legs = buildFlightLegSummaries(booking);
  const email = renderPaymentReceived({
    customerName: "NGUYEN TO HOAN",
    orderCode: "APG-260707-D56624",
    pnr: "5M658W",
    flightLegs: legs,
    paidAmount: "4.202.343",
    currency: "VND",
    lookupUrl: "https://tanphuapg.com/tra-cuu",
  });
  assert.match(email.subject, /5M658W/);
  assert.match(email.html, /4\.202\.343/);
  assert.match(email.html, /05:45/);
  assert.match(email.html, /ĐÃ NHẬN THANH TOÁN/);
});
