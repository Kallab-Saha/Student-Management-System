import { useCallback, useState } from 'react';
import type { PortalBootstrapData } from './types/portal';
import { fetchPortalData, setAuthToken } from './api/client';
import { LoginView } from './components/LoginView';
import { PortalShell } from './components/PortalShell';

export default function App() {
  const [portalData, setPortalData] = useState<PortalBootstrapData | null>(null);

  const handleRefresh = useCallback(async () => {
    const fresh = await fetchPortalData();
    setPortalData(fresh);
  }, []);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setPortalData(null);
  }, []);

  if (!portalData) {
    return <LoginView onLoginSuccess={setPortalData} />;
  }

  return (
    <PortalShell
      data={portalData}
      onRefresh={handleRefresh}
      onLogout={handleLogout}
    />
  );
}
