import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServerOps Simulator",
  description: "DDD/TDD 기반 서버 운영 장애 시뮬레이터"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
