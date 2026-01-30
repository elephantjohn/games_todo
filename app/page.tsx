"use client";

import dynamic from "next/dynamic";

// Dynamically import the Game component to disable SSR
// (Matter.js needs window/canvas access which isn't available on server)
const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen text-amber-600 animate-pulse">
      Loading game assets...
    </div>
  ),
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-amber-50">
      <h1 className="text-3xl font-extrabold text-amber-900 mb-6 tracking-tight drop-shadow-sm">
        Fruit Merge 🍉
      </h1>
      <Game />
    </main>
  );
}
