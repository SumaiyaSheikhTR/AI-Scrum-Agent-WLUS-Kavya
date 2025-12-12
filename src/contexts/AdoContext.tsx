import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import adoService, { AdoConfig } from '../services/adoService';

// Interface for the context value
interface AdoContextValue {
  config: AdoConfig | null;
  updateConfig: (config: AdoConfig) => void;
  isConfigured: boolean;
  testConnection: (config: AdoConfig) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

// Create the context with a default value
const AdoContext = createContext<AdoContextValue>({
  config: null,
  updateConfig: () => {},
  isConfigured: false,
  testConnection: async () => false,
  loading: false,
  error: null
});

// Props for the provider component
interface AdoProviderProps {
  children: ReactNode;
}

// Provider component that wraps the app
export const AdoProvider: React.FC<AdoProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<AdoConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load config from localStorage on initial render
  useEffect(() => {
    try {
      const configFromStorage = localStorage.getItem('adoConfig');
      if (configFromStorage) {
        const parsedConfig = JSON.parse(configFromStorage);
        setConfig(parsedConfig);
        setIsConfigured(true);
        adoService.loadConfig(); // Make sure the service has the config too
      }
    } catch (err) {
      console.error('Error loading ADO config from localStorage:', err);
      setError('Failed to load ADO configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to update the config
  const updateConfig = (newConfig: AdoConfig) => {
    try {
      localStorage.setItem('adoConfig', JSON.stringify(newConfig));
      setConfig(newConfig);
      setIsConfigured(true);
      adoService.updateConfig(newConfig);
      setError(null);
    } catch (err) {
      console.error('Error updating ADO config:', err);
      setError('Failed to update ADO configuration');
    }
  };

  // Function to test connection
  const testConnection = async (testConfig: AdoConfig): Promise<boolean> => {
    try {
      return await adoService.testConnection(testConfig);
    } catch (err) {
      console.error('Error testing ADO connection:', err);
      setError('Failed to test ADO connection');
      return false;
    }
  };

  // Context value
  const contextValue: AdoContextValue = {
    config,
    updateConfig,
    isConfigured,
    testConnection,
    loading,
    error
  };

  return <AdoContext.Provider value={contextValue}>{children}</AdoContext.Provider>;
};

// Custom hook to use the context
export const useAdoContext = () => {
  const context = useContext(AdoContext);
  if (context === undefined) {
    throw new Error('useAdoContext must be used within an AdoProvider');
  }
  return context;
};

export default AdoContext;