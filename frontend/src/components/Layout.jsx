import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col bg-wildcats-background dark:bg-gray-900">
      {isAuthenticated && <Navbar userRole={currentUser?.role} />}
      <main className="flex-grow p-4 md:p-6 lg:p-8 container mx-auto max-w-7xl">
        {children || <Outlet />}
      </main>
      <footer className="p-4 bg-gradient-to-r from-maroon-800 to-maroon-700 dark:from-maroon-900 dark:to-maroon-800 text-white">
        <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center">
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