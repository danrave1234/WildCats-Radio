import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NewSidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider } from './ui/sidebar';
import { EnhancedScrollArea } from './ui/enhanced-scroll-area';

const MainContent = ({ children }) => {
  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden">
      <Header />
      <EnhancedScrollArea className="flex-1">
        <main className="p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </EnhancedScrollArea>
    </div>
  );
};

const Layout = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  
  // Controlled sidebar state - always starts minimized
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SidebarProvider 
      defaultOpen={false}
      open={sidebarOpen} 
      onOpenChange={setSidebarOpen}
    >
      <div className="h-screen bg-wildcats-background dark:bg-gray-900 flex overflow-hidden">
        {isAuthenticated && <NewSidebar userRole={currentUser?.role} />}
        <MainContent>
          <Outlet />
          {children}
        </MainContent>
      </div>
    </SidebarProvider>
  );
};

export default Layout; 