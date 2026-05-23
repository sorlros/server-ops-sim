import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell hero">
      <section className="heroCard">
        <p className="eyebrow">DDD · TDD · 상태머신 기반</p>
        <h1>ServerOps Simulator</h1>
        <p className="lead">
          실제 서버에서 자주 발생하는 장애를 웹 터미널로 진단하고 해결하는 운영 학습 시뮬레이터입니다.
        </p>
        <Link className="primaryLink" href="/scenarios">
          시나리오 시작하기
        </Link>
      </section>
    </main>
  );
}
