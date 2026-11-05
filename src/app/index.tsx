import React from 'react';
import {RootNavigator} from './navigation';
import {DatabaseProvider} from './providers/DatabaseProvider';
import {GestureProvider} from './providers/GestureProvider';
import {ThemeProvider} from './providers/ThemeProvider';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <GestureProvider>
        <DatabaseProvider>
          <RootNavigator />
        </DatabaseProvider>
      </GestureProvider>
    </ThemeProvider>
  );
};
