import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  component: string;
  operation: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private timers: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(component: string, operation: string): string {
    const key = `${component}_${operation}_${Date.now()}`;
    this.timers.set(key, performance.now());
    return key;
  }

  endTimer(key: string, component: string, operation: string): void {
    const startTime = this.timers.get(key);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.metrics.push({
        component,
        operation,
        duration,
        timestamp: Date.now()
      });
      this.timers.delete(key);

      // Log performance warnings
      if (duration > 100) {
        console.warn(`🐌 Performance Warning: ${component}.${operation} took ${duration.toFixed(2)}ms`);
      }

      // Keep only last 100 metrics to prevent memory leaks
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }
    }
  }

  getMetrics(component?: string): PerformanceMetrics[] {
    if (component) {
      return this.metrics.filter(m => m.component === component);
    }
    return this.metrics;
  }

  getAverageTime(component: string, operation: string): number {
    const relevantMetrics = this.metrics.filter(
      m => m.component === component && m.operation === operation
    );
    
    if (relevantMetrics.length === 0) return 0;
    
    const totalTime = relevantMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalTime / relevantMetrics.length;
  }

  logSummary(): void {
    console.log('📊 Performance Summary:');
    const components = [...new Set(this.metrics.map(m => m.component))];
    
    components.forEach(component => {
      const operations = [...new Set(this.metrics.filter(m => m.component === component).map(m => m.operation))];
      console.log(`📱 ${component}:`);
      
      operations.forEach(operation => {
        const avgTime = this.getAverageTime(component, operation);
        const count = this.metrics.filter(m => m.component === component && m.operation === operation).length;
        console.log(`  ⏱️  ${operation}: ${avgTime.toFixed(2)}ms avg (${count} calls)`);
      });
    });
  }
}

export const usePerformanceMonitor = (componentName: string) => {
  const monitor = useRef(PerformanceMonitor.getInstance());
  
  const measureOperation = useCallback((operation: string, fn: () => void | Promise<void>) => {
    const key = monitor.current.startTimer(componentName, operation);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          monitor.current.endTimer(key, componentName, operation);
        });
      } else {
        monitor.current.endTimer(key, componentName, operation);
        return result;
      }
    } catch (error) {
      monitor.current.endTimer(key, componentName, operation);
      throw error;
    }
  }, [componentName]);

  const logMetrics = useCallback(() => {
    console.log(`📊 Metrics for ${componentName}:`, monitor.current.getMetrics(componentName));
  }, [componentName]);

  const logSummary = useCallback(() => {
    monitor.current.logSummary();
  }, []);

  return {
    measureOperation,
    logMetrics,
    logSummary
  };
};

export default usePerformanceMonitor; 