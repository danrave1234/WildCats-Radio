import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen flex bg-wildcats-background dark:bg-gray-900">
      {/* Sidebar - Fixed positioning to stay sticky during scroll */}
      {isAuthenticated && <Sidebar userRole={currentUser?.role} />}
      
      {/* Main Content Area - Contains both main content and footer */}
      <div className={`flex flex-col transition-all duration-300 ${isAuthenticated ? 'md:ml-64' : ''}`}>
        <main className={`flex-1 p-4 md:p-6 lg:p-8 ${isAuthenticated ? 'pt-16 md:pt-4' : 'pt-4'}`}>
          <div className="max-w-7xl mx-auto">
            {children || <Outlet />}
          </div>
        </main>
        
        {/* Footer - Only in main content area */}
        <footer className="mt-auto p-4 bg-gradient-to-r from-maroon-600 to-maroon-700 dark:from-maroon-900 dark:to-maroon-800 text-white">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
            <p className="font-medium">&copy; {new Date().getFullYear()} WildCats Radio - All Rights Reserved</p>
            <div className="flex mt-4 md:mt-0 space-x-4">
              <a href="#" className="text-white/80 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-white/80 hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="text-white/80 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout; 