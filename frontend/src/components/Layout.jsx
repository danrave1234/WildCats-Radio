import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NewSidebar from './Sidebar';
import Header from './Header';
import MiniPlayer from './MiniPlayer';
import { SidebarProvider } from './ui/sidebar';
import { EnhancedScrollArea } from './ui/enhanced-scroll-area';

const MainContent = ({ children, onMobileMenuToggle }) => {
  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden">
      <Header onMobileMenuToggle={onMobileMenuToggle} />
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
  const { currentUser } = useAuth();
  
  // Controlled sidebar state - always starts minimized
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <SidebarProvider 
      defaultOpen={false}
      open={sidebarOpen} 
      onOpenChange={setSidebarOpen}
    >
      <div className="h-screen bg-wildcats-background dark:bg-gray-900 flex overflow-hidden">
        <NewSidebar userRole={currentUser?.role} />
        <MainContent onMobileMenuToggle={toggleSidebar}>
          <Outlet />
          {children}
        </MainContent>
        <MiniPlayer />
      </div>
    </SidebarProvider>
  );
};

export default Layout; 