import { expect, test, type Page } from "@playwright/test";

const places = [
  { id: "node:1", name: "서울역", address: "서울역, 용산구, 서울특별시, 대한민국", lat: 37.5547, lon: 126.9707 },
  { id: "node:2", name: "서울특별시청", address: "서울특별시청, 중구, 서울특별시, 대한민국", lat: 37.5663, lon: 126.9779 },
];
async function selectPlaces(page: Page) {
  await page.route("**/api/search?*", async r => {
    const q = new URL(r.request().url()).searchParams.get("q");
    await r.fulfill({ json: { places: q?.includes("서울역") ? [places[0]] : [places[1]] } });
  });
  await page.getByRole("textbox", { name: "출발지", exact: true }).fill("서울역");
  await page.getByRole("button", { name: "출발지 검색", exact: true }).click();
  await page.getByRole("button", { name: /서울역.*선택/ }).click();
  await page.getByRole("textbox", { name: "도착지", exact: true }).fill("시청");
  await page.getByRole("button", { name: "도착지 검색", exact: true }).click();
  await page.getByRole("button", { name: /서울특별시청.*선택/ }).click();
}

test("manual search, selection, road distance and exact map destination", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let requests = 0;
  await page.route("**/api/search?*", async r => { requests++; await r.fulfill({ json: { places: [] } }); });
  await page.goto("/");
  await page.getByRole("textbox", { name: "출발지", exact: true }).fill("서울역");
  await page.waitForTimeout(400);
  expect(requests).toBe(0);
  await expect(page.getByRole("button", { name: "거리 계산하기" })).toBeDisabled();
  await selectPlaces(page);
  await page.route("**/api/route?*", r => r.fulfill({ json: { distance: 2345, duration: 400, coordinates: [[126.9707, 37.5547], [126.9779, 37.5663]] } }));
  await page.getByRole("button", { name: "거리 계산하기" }).click();
  await expect(page.locator(".distance-number")).toHaveText("2.3km");
  const link = page.getByRole("link", { name: "지도에서 보기" });
  await expect(link).toHaveAttribute("target", "_blank");
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.searchParams.get("route")).toBe("37.5547,126.9707;37.5663,126.9779");
  await page.screenshot({ path: test.info().outputPath("desktop.png"), fullPage: true });
  await page.getByRole("textbox", { name: "출발지", exact: true }).fill("부산역");
  await expect(link).toHaveCount(0);
  await expect(page.getByRole("button", { name: "거리 계산하기" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("straight distance is local, swaps selected places, and fits mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/"); await selectPlaces(page);
  await page.getByRole("button", { name: "출발지와 도착지 바꾸기" }).click();
  await expect(page.getByRole("textbox", { name: "출발지", exact: true })).toHaveValue("서울특별시청");
  let calls = 0;
  await page.route("**/api/route?*", r => { calls++; return r.abort(); });
  await page.getByRole("button", { name: "직선거리", exact: true }).click();
  await page.getByRole("button", { name: "거리 계산하기" }).click();
  await expect(page.locator(".distance-number")).toHaveText("1.4km");
  expect(calls).toBe(0);
  const url = new URL((await page.getByRole("link", { name: "지도에서 보기" }).getAttribute("href"))!);
  expect(url.searchParams.has("bbox")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("mobile.png"), fullPage: true });
});

test("empty search and provider errors are actionable", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/search?*", r => r.fulfill({ json: { places: [] } }));
  await page.getByRole("textbox", { name: "출발지", exact: true }).fill("없는장소");
  await page.getByRole("button", { name: "출발지 검색", exact: true }).click();
  await expect(page.getByText(/검색 결과가 없어요/)).toBeVisible();
  await page.route("**/api/search?*", r => r.fulfill({ status: 429, json: { error: "잠시 후 검색 버튼을 다시 눌러 주세요." } }));
  await page.getByRole("button", { name: "출발지 검색", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("잠시 후");
});

test("missing road route does not display a misleading total", async ({ page }) => {
  await page.goto("/"); await selectPlaces(page);
  await page.route("**/api/route?*", r => r.fulfill({ status: 422, json: { error: "자동차 경로를 찾지 못했어요. 직선거리로 확인해 주세요." } }));
  await page.getByRole("button", { name: "거리 계산하기" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("직선거리");
  await expect(page.getByRole("link", { name: "지도에서 보기" })).toHaveCount(0);
  await page.getByRole("button", { name: "직선거리", exact: true }).click();
  await page.getByRole("button", { name: "거리 계산하기" }).click();
  await expect(page.getByRole("link", { name: "지도에서 보기" })).toBeVisible();
});
