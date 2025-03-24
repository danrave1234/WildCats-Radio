import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, register, sendVerificationCode, verifyEmail, error } = useAuth();
  
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  
  // Use these for testing without connecting to backend initially
  const testCredentials = {
    admin: { email: 'admin@wildcats.edu', password: 'admin123', role: 'ADMIN' },
    dj: { email: 'dj@wildcats.edu', password: 'dj123', role: 'DJ' },
    listener: { email: 'listener@wildcats.edu', password: 'listener123', role: 'LISTENER' }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError('');
    
    try {
      // For development/testing without backend
      if (process.env.NODE_ENV === 'development' && email in testCredentials) {
        const testUser = testCredentials[email.split('@')[0]];
        if (password === testUser.password) {
          // Mock successful login
          localStorage.setItem('token', 'mock-jwt-token');
          localStorage.setItem('userId', '1');
          localStorage.setItem('userRole', testUser.role);
          navigate(testUser.role === 'DJ' ? '/dj-dashboard' : 
                   testUser.role === 'ADMIN' ? '/admin' : '/dashboard');
          return;
        }
      }
      
      // Actual login with backend
      const user = await login({ email, password });
      
      // Navigate based on role
      if (user.role === 'DJ') {
        navigate('/dj-dashboard');
      } else if (user.role === 'ADMIN') {
        navigate('/admin');
    } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Login failed. Please check your credentials.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError('');
    
    try {
      await register({ name, email, password, role: 'LISTENER' });
      // Move to verification step
      setIsVerifying(true);
      // Send verification code
      await sendVerificationCode(email);
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Registration failed. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError('');
    
    try {
      await verifyEmail(email, verificationCode);
      setActiveTab('login');
      setIsVerifying(false);
      setLocalError('');
      // Show success message
      alert('Registration successful! Please login.');
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Verification failed. Please try again.');
      console.error('Verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationCode = async () => {
    setIsLoading(true);
    setLocalError('');
    
    try {
      await sendVerificationCode(email);
      alert('Verification code has been sent to your email.');
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to send verification code. Please try again.');
      console.error('Send code error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">WildCats Radio</h2>
            <p className="text-sm text-gray-600">Your campus radio station</p>
          </div>
          
          {!isVerifying ? (
            <>
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  className={`flex-1 py-2 px-4 text-center ${
                    activeTab === 'login'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500'
                  }`}
                  onClick={() => setActiveTab('login')}
                >
                  Login
                </button>
                <button
                  className={`flex-1 py-2 px-4 text-center ${
                    activeTab === 'register'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500'
                  }`}
                  onClick={() => setActiveTab('register')}
                >
                  Register
                </button>
        </div>
        
              {activeTab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-6">
            <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
                  
            <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
                  
                  {(error || localError) && (
                    <div className="text-red-500 text-sm">
                      {error || localError}
                    </div>
                  )}
                  
                  <div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
          </div>

                  <div>
                    <label htmlFor="register-email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                  
                  <div>
                    <label htmlFor="register-password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <input
                      id="register-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                  
                  {(error || localError) && (
                    <div className="text-red-500 text-sm">
                      {error || localError}
            </div>
          )}

          <div>
            <button
              type="submit"
                      disabled={isLoading}
                      className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
            >
                      {isLoading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
              )}
            </>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Verify Your Email</h3>
                <p className="text-sm text-gray-600">
                  We've sent a verification code to {email}. Please enter it below.
                </p>
              </div>
              
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <input
                  id="verification-code"
                  name="code"
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
          </div>
          
              {(error || localError) && (
                <div className="text-red-500 text-sm">
                  {error || localError}
                </div>
              )}
              
              <div>
            <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Verifying...' : 'Verify Email'}
            </button>
              </div>
              
              <div className="text-center mt-4">
            <button
              type="button"
                  onClick={resendVerificationCode}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Didn't receive the code? Resend
            </button>
          </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login; 