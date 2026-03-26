export const dynamic = 'force-dynamic';

import LivePrice from './components/LivePrice';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 pt-4 pb-8 sm:px-6 sm:pt-5">
      <div className="w-full max-w-5xl mx-auto">
        <LivePrice />
      </div>
    </main>
  );
}
