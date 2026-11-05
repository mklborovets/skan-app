import React, {createContext, useContext} from 'react';
import {AppTheme, theme} from '@shared/config/theme';

const ThemeContext = createContext<AppTheme>(theme);

export interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useAppTheme = (): AppTheme => useContext(ThemeContext);
