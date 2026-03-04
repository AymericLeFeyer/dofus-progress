import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { router } from './router';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';

export function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const { isDark } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ConfigProvider
      locale={frFR}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#c0902b',
          colorLink: '#c0902b',
        },
      }}
    >
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  );
}
