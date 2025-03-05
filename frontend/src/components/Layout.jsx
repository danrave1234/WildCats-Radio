import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = ({ children, userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Role-based access control
  useEffect(() => {
    // Redirect based on user role and current path
    const path = location.pathname;
    
    // Prevent DJ from accessing listener dashboard
    if (userRole === 'DJ' && path === '/dashboard') {
      navigate('/dj-dashboard');
      return;
    }
    
    // Prevent listener from accessing DJ dashboard
    if (userRole === 'LISTENER' && path === '/dj-dashboard') {
      navigate('/dashboard');
      return;
    }
    
    // Prevent unauthorized access to admin pages
    if (userRole !== 'ADMIN' && path === '/admin') {
      navigate('/dashboard');
      return;
    }
    
    // Redirect to appropriate dashboard from home page
    if (path === '/' || path === '') {
      if (userRole === 'DJ') {
        navigate('/dj-dashboard');
      } else if (userRole === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [userRole, location.pathname, navigate]);
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      <Navbar userRole={userRole} />
      <main className="py-6 flex-grow w-full">
        <div className="container mx-auto px-4">
          {children}
        </div>
      </main>
      <footer className="bg-white dark:bg-gray-800 py-4 text-center text-gray-500 dark:text-gray-400 text-sm w-full">
        © {new Date().getFullYear()} WildCats Radio. All rights reserved.
      </footer>
    </div>
  );
};

export default Layout; 