// Statistics page component

export default function StatisticsPage() {
  // Mock data for statistics
  const stats = {
    totalMessages: 1248,
    totalChats: 36,
    averageLength: 34,
    popularTopics: [
      { name: 'Technical Support', count: 15 },
      { name: 'Product Questions', count: 12 },
      { name: 'General Inquiries', count: 9 }
    ]
  };
  
  return (
    <div className="flex flex-col h-full p-8 pt-16 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <h1 className="text-2xl font-bold mb-8">Chat Statistics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Summary Cards - First column */}
        <div className="bg-[var(--bg-secondary)] rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Overview</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--theme-color)] rounded-lg">
              <p className="text-sm text-white">Total Messages</p>
              <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
            </div>
            
            <div className="p-4 bg-[var(--theme-color)] rounded-lg">
              <p className="text-sm text-white">Total Chats</p>
              <p className="text-2xl font-bold text-white">{stats.totalChats}</p>
            </div>
            
            <div className="p-4 bg-[var(--theme-color)] rounded-lg">
              <p className="text-sm text-white">Avg. Messages per Chat</p>
              <p className="text-2xl font-bold text-white">{stats.averageLength}</p>
            </div>
            
            <div className="p-4 bg-[var(--theme-color)] rounded-lg">
              <p className="text-sm text-white">Active Today</p>
              <p className="text-2xl font-bold text-white">5</p>
            </div>
          </div>
        </div>
        
        {/* Activity Chart - Second column */}
        <div className="bg-[var(--bg-secondary)] rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Activity Over Time</h2>
          
          <div className="h-64 flex items-end space-x-2 mt-4">
            {Array.from({ length: 12 }).map((_, i) => {
              const height = 30 + Math.random() * 70;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-[var(--theme-color)] rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                  <span className="text-xs text-[var(--text-tertiary)] mt-1">
                    {`${i+1}`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-2 text-[var(--text-tertiary)] text-sm">Month</div>
        </div>
      
        {/* Popular Topics - Full width at bottom */}
        <div className="bg-[var(--bg-secondary)] rounded-lg shadow p-6 md:col-span-2">
          <h2 className="text-lg font-medium mb-4">Popular Topics</h2>
          
          {/* Left blank for future implementation */}
          <div className="h-48 flex items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-lg">
            <p className="text-[var(--text-tertiary)] text-base font-medium italic">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
