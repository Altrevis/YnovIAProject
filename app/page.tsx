'use client';

import Navbar from '@/components/ui/navbar';
import FilterPanel from '@/components/ui/filter-panel';
import ChatArea from '@/components/ui/chat-area';
import InputArea from '@/components/ui/input-area';
import ResultsTable from '@/components/ui/results-table';

export default function Home() {
  return (
    <div
      style={{ backgroundColor: 'var(--bg-main)' }}
      className="relative isolate flex flex-col w-screen min-h-screen font-sans overflow-x-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#f7f7fc,#ffffff)] opacity-100 transition-opacity duration-500 dark:opacity-0" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b0b0f,#12121a)] opacity-0 transition-opacity duration-500 dark:opacity-100" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />

        <main className="flex flex-1 gap-4 px-6 pt-24 pb-6 overflow-visible w-screen">
          {/* Left: Filters */}
          <aside className="w-[298px] flex-shrink-0 max-h-[660px] flex flex-col">
            <FilterPanel />
          </aside>

          {/* Right: Chat + Input */}
          <div className="flex-1 flex flex-col gap-3 overflow-visible">
            <div className="flex-shrink-0 h-[550px]">
              <ChatArea />
            </div>
            <div className="flex-shrink-0 h-[100px]">
              <InputArea />
            </div>
          </div>
        </main>

        {/* Results - Full Width */}
        <div className="flex-1 px-6 pb-6 overflow-visible w-screen">
          <ResultsTable />
        </div>
      </div>
    </div>
  );
}

