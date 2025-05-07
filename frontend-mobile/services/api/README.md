# WildCats Radio API Client

This API client provides a robust, type-safe interface to the WildCats Radio backend API.

## Features

- 📡 Complete API client for all WildCats Radio backend endpoints
- 🔑 Authentication token management with AsyncStorage
- 🔄 Automatic token injection into requests
- 📝 Request/response logging for debugging
- 🛡️ Comprehensive error handling with typed error responses
- 🧠 Data caching and state management with React Query
- 📦 TypeScript interfaces for all API models

## Setup

The API client is pre-configured to connect to a local development backend running on port 8080.

- For Android emulator: `http://10.0.2.2:8080/api` (default)
- For iOS simulator: Change to `http://localhost:8080/api`
- For physical devices: Change to your machine's IP or a deployed backend URL

## Usage

### Wrap your app with ApiProvider

In your root component (e.g., App.tsx), wrap your app with the ApiProvider:

```tsx
import { ApiProvider } from './services/api';

export default function App() {
  return (
    <ApiProvider>
      {/* The rest of your app */}
    </ApiProvider>
  );
}
```

### Authentication

```tsx
import { useAuth } from './services/api';

function LoginScreen() {
  const { login } = useAuth();
  
  const handleLogin = async () => {
    try {
      await login.mutateAsync({
        email: 'user@example.com',
        password: 'password123'
      });
      // Navigate to Home screen on success
    } catch (error) {
      // Handle login error
    }
  };
  
  return (
    // Your login UI
  );
}
```

### Fetching Data

```tsx
import { useBroadcasts } from './services/api';

function BroadcastsScreen() {
  const { useAllBroadcasts } = useBroadcasts();
  const { data, isLoading, error } = useAllBroadcasts();
  
  if (isLoading) return <LoadingIndicator />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <FlatList
      data={data}
      renderItem={({ item }) => <BroadcastItem broadcast={item} />}
      keyExtractor={(item) => item.id.toString()}
    />
  );
}
```

### Mutations

```tsx
import { useBroadcasts } from './services/api';

function CreateBroadcastScreen() {
  const { createBroadcast } = useBroadcasts();
  
  const handleCreate = async () => {
    try {
      await createBroadcast.mutateAsync({
        title: 'Jazz Night',
        description: 'A night of smooth jazz tunes',
        scheduledStart: '2023-06-15T20:00:00Z',
        scheduledEnd: '2023-06-15T22:00:00Z',
        djId: 123
      });
      // Navigate back or show success message
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    // Your create broadcast form
  );
}
```

## Direct API Access

If needed, you can also use the services directly:

```tsx
import { broadcastService } from './services/api';

// Example of direct service usage
const fetchBroadcasts = async () => {
  try {
    const broadcasts = await broadcastService.getAllBroadcasts();
    // Do something with broadcasts
  } catch (error) {
    // Handle error
  }
};
```

## Error Handling

All API errors are standardized to the `ApiError` interface, making error handling consistent across the app. 