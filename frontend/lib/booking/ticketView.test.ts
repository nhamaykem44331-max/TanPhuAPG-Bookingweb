import assert from "node:assert/strict";
import { test } from "node:test";

import { holdFlightSelectionSchema } from "@/lib/bookings/schemas";
import { bookingToTicketProps } from "@/lib/ticket/bookingToTicketProps";

import { buildTicketView, toTicketSourceLegs } from "./ticketView";

test("schema giữ chỗ không loại bỏ metadata hành lý của fare đã chọn", () => {
  const flight = holdFlightSelectionSchema.parse({
    id: "vn7164",
    searchId: "search-vn",
    fareId: "fare-b",
    airlineCode: "VN",
    departure: { airport: "DAD", time: "2026-07-26T20:35:00+07:00" },
    arrival: { airport: "HAN", time: "2026-07-26T22:00:00+07:00" },
    namthanh: {
      fareId: "fare-b",
      class: "B",
      carryOnText: "10kg xách tay",
      checkedBaggageText: "1 kiện / 23kg",
    },
  });

  assert.equal(flight.namthanh?.checkedBaggageText, "1 kiện / 23kg");
  assert.equal(flight.namthanh?.carryOnText, "10kg xách tay");
});

test("giữ nguyên hành lý VNA theo số kiện từ quote đến mặt vé", () => {
  const view = buildTicketView({
    namthanhRawJson: {
      quote: {
        legs: [
          {
            legKey: "outbound",
            route: "DAD-HAN",
            airline: "VN",
            fareClass: "B",
            departureAt: "2026-07-26T20:35:00+07:00",
            arrivalAt: "2026-07-26T22:00:00+07:00",
            baggageChecked: "1 kiện / 23kg",
            baggageCarryOn: "10kg xách tay",
          },
        ],
      },
      request: {
        passengers: [{ type: "ADT", title: "MR", firstName: "HONG KHAI", lastName: "LE" }],
      },
      holdResult: {
        flight: { flightNumber: "VN7164" },
      },
    },
    pnrs: [
      {
        airline: "VN",
        pnr: "EHRUXP",
        status: "HELD",
        routeSummary: "DAD-HAN",
        departAt: new Date("2026-07-26T20:35:00+07:00"),
        timelimit: new Date("2026-07-25T18:00:00+07:00"),
      },
    ],
  });

  assert.equal(view.itinerary[0]?.baggageChecked, "1 kiện / 23kg");
  assert.equal(view.itinerary[0]?.baggageCarryOn, "10kg xách tay");

  const ticket = bookingToTicketProps({
    status: "hold",
    referenceCode: "EHRUXP",
    legs: toTicketSourceLegs(view.itinerary),
    passengers: view.passengers,
    total: 3_000_000,
    hold: {
      amountDue: 3_000_000,
      bankCode: "MB",
      bankAccount: "123456",
      transferContent: "APGEHRUXP",
      qrImageUrl: "",
      deadlineIso: "2026-07-25T18:00:00+07:00",
    },
  });

  assert.equal(ticket.legs[0]?.baggageChecked, "1 kiện / 23kg");
  assert.equal(ticket.legs[0]?.baggageCarryOn, "10kg xách tay");
});
