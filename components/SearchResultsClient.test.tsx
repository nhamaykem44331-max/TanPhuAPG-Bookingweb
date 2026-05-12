import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { cleanup, fireEvent, render } from "@testing-library/react";
import { JSDOM } from "jsdom";
import React from "react";

import { SearchResultsContent } from "./SearchResultsClient";
import type { DateStripProps } from "./search/DateStrip";
import type { FlightResult, SearchResponse } from "@/lib/types";

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

type FetchMock = typeof fetch & {
  calls: Array<{ body: SearchResponse; input: string; init?: RequestInit }>;
  queue: SearchResponse[];
};

function makeSearchResponse(overrides: Partial<SearchResponse["metadata"]> = {}): SearchResponse {
  return {
    metadata: {
      searchTime: 32,
      totalResults: 0,
      ...overrides,
    },
    results: [],
    searchId: "search-test",
  };
}

function makeFlight(overrides: Partial<FlightResult> = {}): FlightResult {
  return {
    id: overrides.id ?? "flight-test-1",
    airline: overrides.airline ?? "Vietnam Airlines",
    airlineCode: overrides.airlineCode ?? "VN",
    flightNumber: overrides.flightNumber ?? "VN123",
    departure: overrides.departure ?? {
      airport: "HAN",
      airportName: "Noi Bai",
      city: "Ha Noi",
      time: "2026-04-26T07:00:00+07:00",
    },
    arrival: overrides.arrival ?? {
      airport: "SGN",
      airportName: "Tan Son Nhat",
      city: "Ho Chi Minh",
      time: "2026-04-26T09:10:00+07:00",
    },
    duration: overrides.duration ?? 130,
    stops: overrides.stops ?? 0,
    price: overrides.price ?? {
      amount: 1790000,
      currency: "VND",
      source: "namthanh",
    },
    priceUSD: overrides.priceUSD ?? 72,
    sources: overrides.sources ?? ["namthanh"],
    ...overrides,
  };
}

function makeSseResponse(body: SearchResponse): Response {
  const eventBody = [
    `event: session\ndata: ${JSON.stringify({ type: "session", airlines: ["TEST"] })}\n\n`,
    `event: airline_result\ndata: ${JSON.stringify({
      type: "airline_result",
      results: body.results,
      departureResults: body.departureResults ?? body.results,
      returnResults: body.returnResults ?? [],
      completedCount: 1,
      totalCount: 1,
    })}\n\n`,
    `event: done\ndata: ${JSON.stringify({ type: "done" })}\n\n`,
  ].join("");

  return new Response(eventBody, {
    headers: { "Content-Type": "text/event-stream" },
    status: 200,
  });
}

function installSearchFetchMock(...responses: SearchResponse[]): FetchMock {
  const mock = ((input: RequestInfo | URL, init?: RequestInit) => {
    const body = mock.queue.shift() || responses[responses.length - 1] || makeSearchResponse();
    mock.calls.push({ body, input: String(input), init });

    return Promise.resolve(makeSseResponse(body));
  }) as FetchMock;

  mock.calls = [];
  mock.queue = [...responses];
  globalThis.fetch = mock;

  return mock;
}

function MockDateStrip({ destination, direction, origin, onSelect }: DateStripProps) {
  const nextDate = direction === "depart" ? "2026-04-27" : "2026-05-07";

  return (
    <button data-testid={`date-strip-${direction}`} type="button" onClick={() => onSelect(nextDate)}>
      {direction}:{origin}-{destination}
    </button>
  );
}

beforeEach(() => {
  installSearchFetchMock(makeSearchResponse());
});

afterEach(() => {
  cleanup();
});

describe("<SearchResultsContent /> DateStrip integration", () => {
  it("one-way render đúng 1 card Chiều đi và 1 DateStrip", async () => {
    installSearchFetchMock(makeSearchResponse({ totalResults: 3 }));
    const params = new URLSearchParams("from=HAN&to=SGN&date=2026-04-26&tripType=oneway");
    const { findByText, getByTestId, queryByTestId } = render(
      <SearchResultsContent DateStripComponent={MockDateStrip} replace={() => undefined} searchParams={params} />,
    );

    await findByText("Chiều đi");

    assert.equal(getByTestId("date-strip-depart").textContent, "depart:HAN-SGN");
    assert.equal(queryByTestId("date-strip-return"), null);
  });

  it("roundtrip render 2 card và DateStrip chiều về đảo origin/destination", async () => {
    installSearchFetchMock(makeSearchResponse({ departureCount: 4, returnCount: 5, totalResults: 9 }));
    const params = new URLSearchParams("from=HAN&to=SGN&date=2026-04-26&returnDate=2026-05-06&tripType=roundtrip");
    const { findByText, getByTestId } = render(
      <SearchResultsContent DateStripComponent={MockDateStrip} replace={() => undefined} searchParams={params} />,
    );

    await findByText("Chiều đi");
    await findByText("Chiều về");

    assert.equal(getByTestId("date-strip-depart").textContent, "depart:HAN-SGN");
    assert.equal(getByTestId("date-strip-return").textContent, "return:SGN-HAN");
  });

  it("click ngày trong DateStrip gọi router.replace với URL mới đúng ISO date", async () => {
    installSearchFetchMock(makeSearchResponse({ totalResults: 3 }));
    const replaceCalls: string[] = [];
    const params = new URLSearchParams("from=HAN&to=SGN&date=2026-04-26&adults=1&children=0&infants=0&cabin=economy&tripType=oneway");
    const { findByTestId } = render(
      <SearchResultsContent DateStripComponent={MockDateStrip} replace={(href) => replaceCalls.push(href)} searchParams={params} />,
    );

    fireEvent.click(await findByTestId("date-strip-depart"));

    assert.equal(replaceCalls.length, 1);

    const nextUrl = new URL(replaceCalls[0], "http://localhost");

    assert.equal(nextUrl.pathname, "/search");
    assert.equal(nextUrl.searchParams.get("from"), "HAN");
    assert.equal(nextUrl.searchParams.get("to"), "SGN");
    assert.equal(nextUrl.searchParams.get("date"), "2026-04-27");
    assert.equal(nextUrl.searchParams.get("tripType"), "oneway");
  });
});
