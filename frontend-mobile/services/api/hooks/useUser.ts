import { useQuery } from '@tanstack/react-query';
import { authService } from '../endpoints/authService';
import { User } from '../types';

/**
 * Hook for fetching and managing current user data
 */
export const useUser = () => {
  const userQuery = useQuery<User>({
    queryKey: ['user'],
    queryFn: () => authService.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    error: userQuery.error,
    refetch: userQuery.refetch,
  };
}; 