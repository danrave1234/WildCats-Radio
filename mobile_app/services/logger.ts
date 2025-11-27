interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export const createLogger = (component: string): Logger => {
  const isDev = __DEV__;
  
  const formatMessage = (level: string, message: string, args: any[]) => {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] ${level} [${component}] ${message}${argsStr}`;
  };

  return {
    debug: (message: string, ...args: any[]) => {
      if (isDev) {
        console.debug(formatMessage('DEBUG', message, args));
      }
    },
    info: (message: string, ...args: any[]) => {
      if (isDev) {
        console.info(formatMessage('INFO', message, args));
      }
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(formatMessage('WARN', message, args));
    },
    error: (message: string, ...args: any[]) => {
      console.error(formatMessage('ERROR', message, args));
    },
  };
};

