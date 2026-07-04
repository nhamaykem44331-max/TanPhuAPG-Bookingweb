import { expect, type Page, test } from "@playwright/test";

const ONE_WAY_URL =
  "/search?from=HAN&to=SGN&date=2026-04-26&adults=1&children=0&infants=0&cabin=economy&tripType=oneway";
const ROUNDTRIP_URL =
  "/search?from=HAN&to=SGN&date=2026-04-26&returnDate=2026-05-06&adults=1&children=0&infants=0&cabin=economy&tripType=roundtrip";

interface RouteCounters {
  lowestFare: string[];
  search: string[];
}

type MockSearchPayload = Record<string, unknown>;
type MockSearchResponseFactory = (payload: MockSearchPayload) => unknown;

function emptySearchResponse() {
  return {
    metadata: {
      searchTime: 24,
      totalResults: 0,
    },
    results: [],
    searchId: "e2e-search",
  };
}

function homepageSearchResponse(payload: MockSearchPayload) {
  const from = String(payload.from || "HAN");
  const to = String(payload.to || "SGN");
  const date = String(payload.date || "2026-04-26");

  return {
    metadata: {
      searchTime: 1.2,
      totalResults: 1,
    },
    results: [
      {
        airline: "Vietjet Air",
        airlineCode: "VJ",
        arrival: {
          airport: to,
          airportName: to,
          city: to,
          time: `${date}T23:55:00+07:00`,
        },
        departure: {
          airport: from,
          airportName: from,
          city: from,
          time: `${date}T21:45:00+07:00`,
        },
        duration: 130,
        fareBreakdown: {
          baseAmount: 1610000,
          currency: "VND",
          taxesFees: 180000,
          totalAmount: 1790000,
        },
        flightNumber: "VJ167",
        id: `homepage-${from}-${to}-${date}`,
        price: {
          amount: 1790000,
          currency: "VND",
          source: "e2e",
        },
        priceUSD: 68,
        searchId: "e2e-homepage-search",
        sources: ["e2e"],
        stops: 0,
      },
    ],
    searchId: "e2e-homepage-search",
  };
}

function lowestFareResponse(origin: string, destination: string) {
  return {
    cachedAt: "2026-04-25T01:24:59.611Z",
    currency: "VND",
    depart: {
      "4-2026": [
        { day: 24, fareAmount: 2469000, fareDisplay: "2.469.000 đ", month: 4, year: 2026 },
        { day: 25, fareAmount: 2049000, fareDisplay: "2.049.000 đ", month: 4, year: 2026 },
        { day: 26, fareAmount: 1790000, fareDisplay: "1.790.000 đ", month: 4, year: 2026 },
        { day: 27, fareAmount: 2150000, fareDisplay: "2.150.000 đ", month: 4, year: 2026 },
        { day: 28, fareAmount: 2000000, fareDisplay: "2.000.000 đ", month: 4, year: 2026 },
        { day: 29, fareAmount: 1990000, fareDisplay: "1.990.000 đ", month: 4, year: 2026 },
        { day: 30, fareAmount: 1610000, fareDisplay: "1.610.000 đ", month: 4, year: 2026 },
      ],
    },
    return: {
      "5-2026": [
        { day: 4, fareAmount: 2469000, fareDisplay: "2.469.000 đ", month: 5, year: 2026 },
        { day: 5, fareAmount: 2049000, fareDisplay: "2.049.000 đ", month: 5, year: 2026 },
        { day: 6, fareAmount: 1790000, fareDisplay: "1.790.000 đ", month: 5, year: 2026 },
        { day: 7, fareAmount: 2150000, fareDisplay: "2.150.000 đ", month: 5, year: 2026 },
        { day: 8, fareAmount: 2000000, fareDisplay: "2.000.000 đ", month: 5, year: 2026 },
      ],
    },
    route: { destination, origin },
    serverNow: "2026-04-25T01:25:00.000Z",
    ttlSeconds: 300,
  };
}

async function installHappyMocks(
  page: Page,
  options: { searchResponse?: MockSearchResponseFactory } = {},
): Promise<RouteCounters> {
  const counters: RouteCounters = { lowestFare: [], search: [] };

  await page.route("**/api/search/lowest-fare?**", async (route) => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get("from") || "HAN";
    const to = url.searchParams.get("to") || "SGN";

    counters.lowestFare.push(`${from}-${to}`);

    await route.fulfill({
      contentType: "application/json",
      json: lowestFareResponse(from, to),
      status: 200,
    });
  });

  await page.route("**/api/search", async (route) => {
    const postData = route.request().postData() || "";
    let payload: MockSearchPayload = {};

    try {
      payload = JSON.parse(postData) as MockSearchPayload;
    } catch {
      payload = {};
    }

    counters.search.push(postData);

    await route.fulfill({
      contentType: "application/json",
      json: options.searchResponse ? options.searchResponse(payload) : emptySearchResponse(),
      status: 200,
    });
  });

  return counters;
}

async function installLowestFareDownMock(page: Page): Promise<RouteCounters> {
  const counters: RouteCounters = { lowestFare: [], search: [] };

  await page.route("**/api/search/lowest-fare?**", async (route) => {
    counters.lowestFare.push(route.request().url());

    await route.fulfill({
      contentType: "application/json",
      json: { error: "BACKEND_UNAVAILABLE" },
      status: 502,
    });
  });

  await page.route("**/api/search", async (route) => {
    counters.search.push(route.request().postData() || "");

    await route.fulfill({
      contentType: "application/json",
      json: emptySearchResponse(),
      status: 200,
    });
  });

  return counters;
}

async function waitForDateStrip(page: Page) {
  await expect(page.getByText("Chiều đi")).toBeVisible();
  await expect(page.getByText("1.790K").first()).toBeVisible();
}

test.describe("Sprint F DateStrip e2e", () => {
  test("single fetch: click 3 ngày khác nhau không gọi lại lowest-fare", async ({ page }) => {
    const counters = await installHappyMocks(page);

    await page.goto(ONE_WAY_URL);
    await waitForDateStrip(page);

    await page.getByText("2.150K").click();
    await expect(page).toHaveURL(/date=2026-04-27/);
    await page.getByText("2.000K").click();
    await expect(page).toHaveURL(/date=2026-04-28/);
    await page.getByText("1.990K").click();
    await expect(page).toHaveURL(/date=2026-04-29/);

    expect(counters.lowestFare).toEqual(["HAN-SGN"]);
    expect(counters.search).toHaveLength(4);
  });

  test("no re-fetch on day click: URL đổi và search gọi lại, lowest-fare vẫn 1 request", async ({ page }) => {
    const counters = await installHappyMocks(page);

    await page.goto(ONE_WAY_URL);
    await waitForDateStrip(page);

    await page.getByText("2.150K").click();

    await expect(page).toHaveURL(/date=2026-04-27/);
    expect(counters.search).toHaveLength(2);
    expect(counters.lowestFare).toHaveLength(1);
  });

  test("re-fetch on route change: đổi route thì lowest-fare gọi thêm 1 lần", async ({ page }) => {
    const counters = await installHappyMocks(page);

    await page.goto(ONE_WAY_URL);
    await waitForDateStrip(page);
    await page.goto("/search?from=DAD&to=SGN&date=2026-04-26&adults=1&children=0&infants=0&cabin=economy&tripType=oneway");
    await waitForDateStrip(page);

    expect(counters.lowestFare).toEqual(["HAN-SGN", "DAD-SGN"]);
  });

  test("roundtrip: render 2 DateStrip và gọi lowest-fare cho cả 2 chiều", async ({ page }) => {
    const counters = await installHappyMocks(page);

    await page.goto(ROUNDTRIP_URL);

    await expect(page.getByText("Chiều đi")).toBeVisible();
    await expect(page.getByText("Chiều về")).toBeVisible();
    await expect(page.getByLabel("Giá theo ngày chiều đi")).toBeVisible();
    await expect(page.getByLabel("Giá theo ngày chiều về")).toBeVisible();

    expect(counters.lowestFare).toEqual(["HAN-SGN", "SGN-HAN"]);
  });

  test("backend down: fallback hiển thị và Thử lại tạo request mới", async ({ page }) => {
    const counters = await installLowestFareDownMock(page);

    await page.goto(ONE_WAY_URL);

    await expect(page.getByText("Không lấy được giá theo ngày")).toBeVisible();
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByText("Không lấy được giá theo ngày")).toBeVisible();

    expect(counters.lowestFare).toHaveLength(2);
  });

  test("homepage: DateStrip tai sau khi tim, click ngay chi refresh search va doi route moi refetch lowest-fare", async ({ page }) => {
    const counters = await installHappyMocks(page, { searchResponse: homepageSearchResponse });
    const dateInput = page.locator('input[type="date"]').first();
    const desktopResultCard = page.locator("div.hidden.lg\\:grid section").first();

    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await dateInput.fill("2026-04-26");
    await page.locator("button.apg-btn-primary").first().click();

    await expect(desktopResultCard.getByText("1.790K").first()).toBeVisible();
    expect(counters.lowestFare).toEqual(["HAN-SGN"]);
    expect(counters.search).toHaveLength(1);

    await desktopResultCard.getByText("2.150K").first().click();

    await expect(dateInput).toHaveValue("2026-04-27");
    await expect.poll(() => counters.search.length).toBe(2);
    expect(counters.lowestFare).toEqual(["HAN-SGN"]);

    await page.getByRole("button", { name: "HAN-DAD" }).click();

    await expect.poll(() => counters.lowestFare).toEqual(["HAN-SGN", "HAN-DAD"]);
  });
});
