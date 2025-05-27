# WildCats Radio Frontend

This is the frontend application for WildCats Radio, built with React and Vite.

## Environment Configuration

The application uses environment variables to configure API endpoints and other settings. These are defined in a single `.env` file for all environments.

### Available Environment Variables

- `VITE_API_BASE_URL`: Base URL for API requests
- `VITE_WS_BASE_URL`: Base URL for WebSocket connections
- `VITE_ICECAST_URL`: URL for the Icecast audio stream

## Development

To run the application in development mode:

```bash
npm install
npm run dev
```

This will use the variables from the `.env` file.

## Production Build

To build the application for production:

```bash
npm run build
```

This will use the variables from the `.env` file.

## Deployment

When deploying to a new environment, make sure to update the environment variables in the `.env` file to point to the correct backend API and WebSocket endpoints.

You can also override these variables at runtime by setting them in your deployment environment.

## Original Vite Documentation

This project was bootstrapped with Vite. For more information about Vite, check out:

- [Vite Documentation](https://vitejs.dev/)
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md)
