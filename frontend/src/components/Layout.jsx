import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NewSidebar from './NewSidebar';
import Header from './Header';
import { SidebarProvider } from './ui/sidebar';

const MainContent = ({ children }) => {
  return (
    <div className="flex flex-col flex-1">
      <Header />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

const Layout = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-wildcats-background dark:bg-gray-900 flex">
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