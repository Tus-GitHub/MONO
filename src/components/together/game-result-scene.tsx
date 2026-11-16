import type { CSSProperties } from "react";

export function GameResultScene({ outcome }: { outcome: "win" | "loss" | "draw" }) {
  return <div className={`mono-result-scene mono-result-${outcome}`} data-game-outcome={outcome} aria-hidden="true">
    <div className="mono-result-halo" />
    {outcome === "win" ? <>
      <div className="mono-result-confetti">{Array.from({ length: 38 }, (_, i) => <i key={i} style={{ "--piece-x": `${(i * 37) % 100}%`, "--piece-drift": `${(i % 2 ? 1 : -1) * (20 + i % 7 * 8)}px`, "--piece-delay": `${i % 11 * 0.09}s`, "--piece-spin": `${180 + i * 39}deg` } as CSSProperties} />)}</div>
      <svg className="mono-result-character" viewBox="0 0 180 180" fill="none">
        <path className="mono-result-spark" d="m30 38 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z M146 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="currentColor" />
        <path d="M60 51H37v15c0 22 15 30 30 30M120 51h23v15c0 22-15 30-30 30" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        <path d="M53 35h74v39a37 37 0 0 1-74 0Z" fill="currentColor" />
        <path d="M90 111v27M65 148h50M73 138h34" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        <path d="m90 49 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" className="mono-result-cutout" fill="currentColor" />
      </svg>
      <span className="mono-result-caption">CHAMPION ENERGY</span>
    </> : outcome === "loss" ? <>
      <span className="mono-result-rain mono-result-rain-one" /><span className="mono-result-rain mono-result-rain-two" /><span className="mono-result-rain mono-result-rain-three" />
      <svg className="mono-result-character" viewBox="0 0 180 180" fill="none">
        <path d="M45 60a29 29 0 0 1 42-27 31 31 0 0 1 54 22 24 24 0 0 1-3 48H48a22 22 0 0 1-3-43Z" fill="currentColor" />
        <g className="mono-result-cutout" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><path d="m64 70 12-4m28 0 12 4M78 91q12-10 24 0" /><path d="M71 77v1m38-1v1" /></g>
        <path className="mono-result-tear" d="M119 84s-7 10-7 14a7 7 0 0 0 14 0c0-4-7-14-7-14Z" fill="currentColor" />
        <path d="M61 137q29 14 58 0" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".25" />
      </svg>
      <span className="mono-result-caption">TINY RAIN CLOUD. BIG COMEBACK.</span>
    </> : <>
      <svg className="mono-result-character" viewBox="0 0 180 180" fill="none">
        <g className="mono-result-draw-left"><circle cx="52" cy="87" r="33" fill="currentColor" /><g className="mono-result-cutout" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="M43 80v2m18-2v2m-20 12q13 13 25-2" /></g></g>
        <g className="mono-result-draw-right"><circle cx="128" cy="87" r="33" fill="currentColor" /><g className="mono-result-cutout" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="m115 82 7-4m13 0 7 4m-22 13q8 8 16 0" /></g></g>
        <path className="mono-result-equals" d="M80 35h20M80 44h20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M75 140q15 9 30 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".3" />
      </svg>
      <span className="mono-result-caption">TWO LEGENDS. ZERO WINNERS.</span>
    </>}
  </div>;
}
