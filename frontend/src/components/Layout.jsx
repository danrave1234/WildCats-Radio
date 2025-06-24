import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NewSidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider } from './ui/sidebar';
import { EnhancedScrollArea } from './ui/enhanced-scroll-area';

const Layout = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const location = useLocation();
  const isDashboard = location.pathname.includes('/dashboard') || location.pathname.startsWith('/broadcast/');
  
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
        {isAuthenticated && <NewSidebar userRole={currentUser?.role} />}
        
        <div className="flex flex-col flex-1 h-screen overflow-hidden">
          <Header onMobileMenuToggle={toggleSidebar} />

          {isDashboard ? (
            <div className="flex-1 bg-background text-foreground">
              <Outlet />
              {children}
            </div>
          ) : (
            <EnhancedScrollArea className="flex-1">
              <main>
                <div className="max-w-auto mx-auto">
                  <Outlet />
                  {children}
                </div>
              </main>
            </EnhancedScrollArea>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout; 