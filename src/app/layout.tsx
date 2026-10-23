import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사이 · 두 장소 사이의 거리",
  description: "출발지와 도착지를 검색하고 두 장소 사이의 자동차 거리와 직선거리를 간편하게 확인하세요.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f7f2" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
