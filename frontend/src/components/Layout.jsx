import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {isAuthenticated && <Navbar userRole={currentUser?.role} />}
      <main className="flex-grow p-4">
        {children || <Outlet />}
      </main>
      <footer className="p-4 bg-maroon-700 dark:bg-maroon-800 text-white text-center">
        <p>&copy; {new Date().getFullYear()} WildCats Radio - All Rights Reserved</p>
      </footer>
    </div>
  );
};

export default Layout; 