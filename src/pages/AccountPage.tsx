// Account page component

export default function AccountPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 pt-16 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="bg-[var(--bg-secondary)] p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Account</h1>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-[var(--theme-color-dark)] bg-opacity-20 mb-4 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[var(--theme-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-medium">User</h2>
          <p className="text-[var(--text-tertiary)]">user@example.com</p>
        </div>
        
        <div className="space-y-4">
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg flex justify-between items-center">
            <span>Profile Settings</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg flex justify-between items-center">
            <span>Privacy</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg flex justify-between items-center">
            <span>Notifications</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          <button className="w-full p-3 mt-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
