# WildCats Radio Frontend

This is the frontend application for WildCats Radio, built with React and Vite.

## Configuration System

The application uses a **centralized configuration system** with automatic environment detection. Configuration is managed in `src/config.js`.

### Automatic Environment Detection

The system automatically detects whether you're running locally or in production:
- **Local**: `localhost`, `127.0.0.1`, or local IP addresses
- **Deployed**: Any other hostname

### Configuration Override Options

You can override the automatic detection using environment variables:

- `REACT_APP_FORCE_LOCAL=true`: Force local environment
- `REACT_APP_FORCE_DEPLOYED=true`: Force deployed environment
- `REACT_APP_API_BASE_URL`: Override API base URL
- `REACT_APP_WS_BASE_URL`: Override WebSocket base URL
- `REACT_APP_SOCKJS_BASE_URL`: Override SockJS base URL
- `REACT_APP_ICECAST_URL`: Override Icecast stream URL

### Changing Backend URLs

To change backend URLs, edit `src/config.js`:

```javascript
const environments = {
  local: {
    apiBaseUrl: 'http://localhost:8080',
    wsBaseUrl: 'ws://localhost:8080',
    sockJsBaseUrl: 'http://localhost:8080',
  },
  deployed: {
    apiBaseUrl: 'https://your-backend.example.com',
    wsBaseUrl: 'wss://your-backend.example.com',
    sockJsBaseUrl: 'https://your-backend.example.com',
  }
};
```

## Development

To run the application in development mode:

```bash
npm install
npm run dev
```

The system will automatically use local configuration.

## Production Build

To build the application for production:

```bash
npm run build
```

The system will automatically use deployed configuration when accessed from a production domain.

## Deployment

The application automatically detects the deployment environment. No manual configuration is needed for most deployments.

For custom deployments, you can override URLs using environment variables or by editing `src/config.js`.

## Original Vite Documentation

This project was bootstrapped with Vite. For more information about Vite, check out:

- [Vite Documentation](https://vitejs.dev/)
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md)
