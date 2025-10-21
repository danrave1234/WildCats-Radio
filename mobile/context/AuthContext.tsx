import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '../services/apiService';

const TOKEN_KEY = 'user_auth_token';

interface AuthContextData {
  authToken: string | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          // Verify cookie-based session with backend
          try {
            const me = await getMe();
            if ((me as any).error) {
              await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
              setAuthToken(null);
            } else {
              setAuthToken(storedToken);
            }
          } catch (verifyErr) {
            console.error('Failed to verify session via /auth/me:', verifyErr);
            await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
            setAuthToken(null);
          }
        }
      } catch (e) {
        console.error('Failed to load auth token:', e);
        // Handle error, maybe try to delete the token if it's corrupted
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}); // Ignore delete error
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  const signIn = async (token: string) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      setAuthToken(token);
    } catch (e) {
      console.error('Failed to save auth token:', e);
      // Optionally, propagate the error to the caller
      throw e;
    }
  };

  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setAuthToken(null);
    } catch (e) {
      console.error('Failed to delete auth token:', e);
      // Optionally, propagate the error to the caller
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{ authToken, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextData => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 