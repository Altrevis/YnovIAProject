'use client';

import Navbar from '@/components/navbar';
import FilterPanel from '@/components/filter-panel';
import ChatArea from '@/components/chat-area';
import InputArea from '@/components/input-area';
import ResultsTable from '@/components/results-table';

export default function Home() {
  return (
    <div className="flex flex-col w-screen min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 font-sans overflow-x-hidden">
      <Navbar />

      <main className="flex flex-1 gap-4 px-6 pt-8 pb-6 overflow-hidden w-screen">
        {/* Left: Filters */}
        <aside className="w-[298px] flex-shrink-0 max-h-[660px] flex flex-col">
          <FilterPanel />
        </aside>

        {/* Right: Chat + Input */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex-shrink-0 h-[550px]">
            <ChatArea />
          </div>
          <div className="flex-shrink-0 h-[100px]">
            <InputArea />
          </div>
        </div>
      </main>

      {/* Results - Full Width */}
      <div className="flex-1 px-6 pb-6 overflow-hidden w-screen">
        <ResultsTable />
      </div>
    </div>
  );
}

