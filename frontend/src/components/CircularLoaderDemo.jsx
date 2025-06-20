import React from 'react';
import CircularLoader from './CircularLoader';

const CircularLoaderDemo = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Circular Loader Components
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Beautiful animated loading spinners for WildCats Radio
          </p>
        </div>

        {/* Sizes Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Different Sizes</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center justify-items-center">
            <div className="text-center">
              <CircularLoader size="sm" variant="primary" text="Small" />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Small (40px)</p>
            </div>
            <div className="text-center">
              <CircularLoader size="md" variant="primary" text="Medium" />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Medium (60px)</p>
            </div>
            <div className="text-center">
              <CircularLoader size="lg" variant="primary" text="Large" />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Large (80px)</p>
            </div>
            <div className="text-center">
              <CircularLoader size="xl" variant="primary" text="Extra Large" />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Extra Large (120px)</p>
            </div>
          </div>
        </div>

        {/* Variants Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Color Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-items-center">
            <div className="text-center">
              <CircularLoader size="lg" variant="primary" text="Primary" />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Primary (Maroon)</p>
            </div>
            <div className="text-center">
              <CircularLoader size="lg" variant="secondary" text="Secondary" />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Secondary (Blue)</p>
            </div>
            <div className="text-center">
              <CircularLoader size="lg" variant="success" text="Success" />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Success (Green)</p>
            </div>
          </div>
        </div>

        {/* Text Options Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Text Options</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-items-center">
            <div className="text-center">
              <CircularLoader size="md" variant="primary" showText={false} />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">No Text</p>
            </div>
            <div className="text-center">
              <CircularLoader size="md" variant="primary" text="Loading..." />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Default Text</p>
            </div>
            <div className="text-center">
              <CircularLoader size="md" variant="primary" text="Fetching data from server..." />
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Custom Text</p>
            </div>
          </div>
        </div>

        {/* Real-world Examples */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Real-world Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Page Loading Example */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Page Loading</h3>
              <CircularLoader 
                size="lg" 
                variant="primary" 
                text="Loading dashboard..." 
                showText={true}
              />
            </div>

            {/* Data Fetching Example */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Fetching</h3>
              <CircularLoader 
                size="md" 
                variant="secondary" 
                text="Loading users..." 
                showText={true}
              />
            </div>

            {/* Analytics Loading Example */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analytics Loading</h3>
              <CircularLoader 
                size="lg" 
                variant="primary" 
                text="Loading analytics data..." 
                showText={true}
              />
            </div>

            {/* Success State Example */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Processing</h3>
              <CircularLoader 
                size="md" 
                variant="success" 
                text="Processing request..." 
                showText={true}
              />
            </div>
          </div>
        </div>

        {/* Implementation Note */}
        <div className="mt-8 p-6 bg-maroon-50 dark:bg-maroon-900/20 border border-maroon-200 dark:border-maroon-800 rounded-lg">
          <h3 className="text-lg font-semibold text-maroon-800 dark:text-maroon-200 mb-2">
            Implementation Notes
          </h3>
          <ul className="text-sm text-maroon-700 dark:text-maroon-300 space-y-1">
            <li>• Built with Framer Motion for smooth animations</li>
            <li>• Supports dark/light themes automatically</li>
            <li>• Four sizes: sm, md, lg, xl</li>
            <li>• Three color variants: primary, secondary, success</li>
            <li>• Customizable text with show/hide option</li>
            <li>• Optimized for WildCats Radio branding</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CircularLoaderDemo; 