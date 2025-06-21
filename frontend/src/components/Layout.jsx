import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col bg-wildcats-background dark:bg-gray-900">
      <div className="flex flex-1">
        {isAuthenticated && <Sidebar userRole={currentUser?.role} />}
        
        <div className={`flex flex-col flex-1 transition-all duration-300 ${isAuthenticated ? 'md:ml-64' : ''}`}>
          <main className={`flex-1 p-4 md:p-6 lg:p-8 ${isAuthenticated ? 'pt-16 md:pt-4' : 'pt-4'}`}>
            <div className="max-w-7xl mx-auto">
              {children || <Outlet />}
            </div>
          </main>
        </div>
      </div>
      
      <footer className={`p-4 bg-gradient-to-r from-maroon-600 to-maroon-700 dark:from-maroon-900 dark:to-maroon-800 text-white transition-all duration-300 ${isAuthenticated ? 'md:pl-72' : ''}`}>
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
  );
};

export default Layout; 