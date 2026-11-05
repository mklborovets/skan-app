import React, {useEffect, useState} from 'react';
import {sqliteClient} from '@shared/db';
import {ensureAppStorageDirectories} from '@shared/lib/file-system/pathResolver';
import {ProcessingOverlay} from '@shared/ui/loader/ProcessingOverlay';

export interface DatabaseProviderProps {
  children: React.ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({
  children,
}) => {
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        await ensureAppStorageDirectories();
        await sqliteClient.initialize();
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <ProcessingOverlay
        visible
        label="Initializing On-Device SQLite & FTS5..."
      />
    );
  }

  return <>{children}</>;
};
