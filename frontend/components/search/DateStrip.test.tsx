import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";
import React from "react";

import DateStrip, { clearDateStripCacheForTests, getTodayInVietnam } from "./DateStrip";
import type { NamThanhLowestFareResponse } from "@/lib/namthanh";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.DOMException = dom.window.DOMException;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});

const RealDate = globalThis.Date;
const FIXED_NOW = "2026-04-25T12:00:00+07:00";

function installFixedDate() {
  class FixedDate extends RealDate {
    constructor(
      ...args:
        | []
        | [value: string | number | Date]
        | [year: number, monthIndex: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number]
    ) {
      if (args.length === 0) {
        super(FIXED_NOW);
      } else if (args.length === 1) {
        super(args[0]);
      } else {
        super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
      }
    }

    static now() {
      return new RealDate(FIXED_NOW).getTime();
    }
  }

  globalThis.Date = FixedDate as DateConstructor;
}

type FetchMock = typeof fetch & {
  calls: string[];
  queue: Response[];
};

function makeLowestFareResponse(days: Array<{ day: number; fareAmount: number }>): NamThanhLowestFareResponse {
  return {
    route: { origin: "HAN", destination: "SGN" },
    depart: {
      "4-2026": days.map((day) => ({
        day: day.day,
        month: 4,
        year: 2026,
        fareAmount: day.fareAmount,
        fareDisplay: `${day.fareAmount.toLocaleString("vi-VN")} đ`,
      })),
    },
    return: {},
    currency: "VND",
    cachedAt: "2026-04-25T01:24:59.611Z",
    ttlSeconds: 300,
  };
}

function fullFiveDayResponse() {
  return makeLowestFareResponse([
    { day: 24, fareAmount: 2469000 },
    { day: 25, fareAmount: 2049000 },
    { day: 26, fareAmount: 1790000 },
    { day: 27, fareAmount: 2150000 },
    { day: 28, fareAmount: 2000000 },
  ]);
}

function multiMonthResponse(): NamThanhLowestFareResponse {
  return {
    ...fullFiveDayResponse(),
    depart: {
      ...fullFiveDayResponse().depart,
      "5-2026": [
        { day: 2, month: 5, year: 2026, fareAmount: 1890000, fareDisplay: "1.890.000 đ" },
        { day: 12, month: 5, year: 2026, fareAmount: 2210000, fareDisplay: "2.210.000 đ" },
      ],
      "6-2026": [
        { day: 3, month: 6, year: 2026, fareAmount: 1750000, fareDisplay: "1.750.000 đ" },
      ],
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function installFetchMock(...responses: Response[]): FetchMock {
  const mock = ((input: RequestInfo | URL) => {
    mock.calls.push(String(input));
    const response = mock.queue.shift() || responses[responses.length - 1];

    return Promise.resolve(response.clone());
  }) as FetchMock;

  mock.calls = [];
  mock.queue = [...responses];
  globalThis.fetch = mock;

  return mock;
}

function dateCells(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("[aria-pressed]"));
}

beforeEach(() => {
  installFixedDate();
  clearDateStripCacheForTests();
});

afterEach(() => {
  globalThis.Date = RealDate;
  cleanup();
});

describe("<DateStrip />", () => {
  it("mount route hợp lệ thì fetch đúng 1 lần và render 7 cells", async () => {
    const fetchMock = installFetchMock(jsonResponse(fullFiveDayResponse()));
    const { container, findByText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    await findByText("1.790K");
    await findByText("* Giá vé cơ bản tham khảo, chưa gồm thuế và phí.");

    assert.equal(fetchMock.calls.length, 1);
    assert.equal(fetchMock.calls[0], "/api/search/lowest-fare?from=HAN&to=SGN");
    assert.equal(dateCells(container).length, 7);
  });

  it("click ngày khác gọi onSelect và không fetch lại lowest-fare", async () => {
    const fetchMock = installFetchMock(jsonResponse(fullFiveDayResponse()));
    const selected: string[] = [];

    const { findByText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={(date) => selected.push(date)}
      />,
    );

    fireEvent.click(await findByText("2.150K"));

    assert.deepEqual(selected, ["2026-04-27"]);
    assert.equal(fetchMock.calls.length, 1);
  });

  it("mở lịch tháng và click ngày trong calendar không fetch lại lowest-fare", async () => {
    const fetchMock = installFetchMock(jsonResponse(fullFiveDayResponse()));
    const selected: string[] = [];

    const { container, findByText, getByLabelText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={(date) => selected.push(date)}
      />,
    );

    await findByText("1.790K");
    fireEvent.click(getByLabelText("Mở lịch tháng"));
    await findByText("Tháng 4/2026");

    const calendarDay = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("28") && button.textContent?.includes("2.000K"));
    assert.ok(calendarDay);
    fireEvent.click(calendarDay);

    assert.deepEqual(selected, ["2026-04-28"]);
    assert.equal(fetchMock.calls.length, 1);
  });

  it("duyệt nhiều tháng trong calendar từ dữ liệu lowest-fare đã cache", async () => {
    const fetchMock = installFetchMock(jsonResponse(multiMonthResponse()));
    const selected: string[] = [];

    const { container, findByText, getByLabelText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={(date) => selected.push(date)}
      />,
    );

    await findByText("1.790K");
    fireEvent.click(getByLabelText("Mở lịch tháng"));
    fireEvent.click(await findByText("Tháng 5/2026"));

    const mayDay = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim().startsWith("2") && button.textContent?.includes("1.890K"));
    assert.ok(mayDay);
    fireEvent.click(mayDay);

    assert.deepEqual(selected, ["2026-05-02"]);
    assert.equal(fetchMock.calls.length, 1);
  });

  it("uses route-specific direct fare buckets for return direction", async () => {
    installFetchMock(jsonResponse(fullFiveDayResponse()));

    const { findByText } = render(
      <DateStrip
        destination="HAN"
        direction="return"
        origin="SGN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    await findByText("1.790K");
  });

  it("đổi origin hoặc destination thì fetch lại đúng route mới", async () => {
    const fetchMock = installFetchMock(jsonResponse(fullFiveDayResponse()), jsonResponse(fullFiveDayResponse()));
    const { findByText, rerender } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    await findByText("1.790K");

    rerender(
      <DateStrip
        destination="DAD"
        direction="depart"
        origin="SGN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    await waitFor(() => assert.equal(fetchMock.calls.length, 2));
    assert.equal(fetchMock.calls[1], "/api/search/lowest-fare?from=SGN&to=DAD");
  });

  it("fare thấp nhất trong dải hiện màu gold (chỉ khi có spread ≥ 50K)", async () => {
    installFetchMock(jsonResponse(fullFiveDayResponse()));

    const { findByText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    // Giá thấp nhất trong fixture: 1.790.000 → "1.790K"
    const bestFareNode = await findByText("1.790K");
    assert.match(bestFareNode.className, /text-amber-600/);

    // Giá khác KHÔNG được màu amber
    const otherFareNode = await findByText("2.469K");
    assert.doesNotMatch(otherFareNode.className, /text-amber-600/);
  });

  it("KHÔNG đánh dấu best khi giá các ngày ngang nhau (spread < 50K)", async () => {
    installFetchMock(
      jsonResponse(
        makeLowestFareResponse([
          { day: 24, fareAmount: 1610000 },
          { day: 25, fareAmount: 1610000 },
          { day: 26, fareAmount: 1610000 },
          { day: 27, fareAmount: 1610000 },
          { day: 28, fareAmount: 1610000 },
        ]),
      ),
    );

    const { findAllByText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    const fareNodes = await findAllByText("1.610K");
    for (const node of fareNodes) {
      assert.doesNotMatch(node.className, /text-amber-600/);
    }
  });

  it("pan ngày trước bị disabled khi selectedDate là hôm nay tại Việt Nam", async () => {
    installFetchMock(jsonResponse(fullFiveDayResponse()));

    const { getByLabelText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate={getTodayInVietnam()}
        onSelect={() => undefined}
      />,
    );

    const previous = getByLabelText("Ngày trước đó") as HTMLButtonElement;

    assert.equal(previous.disabled, true);
  });

  it("ngày không có trong cache render dấu gạch và aria-disabled=true", async () => {
    installFetchMock(
      jsonResponse(
        makeLowestFareResponse([
          { day: 24, fareAmount: 2469000 },
          { day: 25, fareAmount: 2049000 },
          { day: 26, fareAmount: 1790000 },
          { day: 27, fareAmount: 2150000 },
        ]),
      ),
    );
    const { container, findByText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    await findByText("1.790K");
    const missingCell = dateCells(container).find((cell) => cell.textContent?.includes("—"));

    assert.ok(missingCell);
    assert.equal(missingCell?.getAttribute("aria-disabled"), "true");
  });

  it("backend lỗi thì hiện fallback và nút Thử lại gọi fetch lại", async () => {
    const fetchMock = installFetchMock(jsonResponse({ error: "BACKEND_UNAVAILABLE" }, 502), jsonResponse(fullFiveDayResponse()));

    const { findByText, getByText } = render(
      <DateStrip
        destination="SGN"
        direction="depart"
        origin="HAN"
        selectedDate="2026-04-26"
        onSelect={() => undefined}
      />,
    );

    await findByText("Không lấy được giá theo ngày");
    fireEvent.click(getByText("Thử lại"));
    await findByText("1.790K");

    assert.equal(fetchMock.calls.length, 2);
  });
});
