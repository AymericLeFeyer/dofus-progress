import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { CharactersPage } from '../pages/CharactersPage';
import { GuildPage } from '../pages/GuildPage';
import { InvitationsPage } from '../pages/InvitationsPage';
import { AchievementsPage } from '../pages/AchievementsPage';
import { QuestsPage } from '../pages/QuestsPage';
import { DungeonsPage } from '../pages/DungeonsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { useAuth } from '../hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  if (!isInitialized) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  if (!isInitialized) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>,
  },
  {
    path: '/register',
    element: <PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>,
  },
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'characters', element: <CharactersPage /> },
      { path: 'guild', element: <GuildPage /> },
      { path: 'invitations', element: <InvitationsPage /> },
      { path: 'achievements', element: <AchievementsPage /> },
      { path: 'quests', element: <QuestsPage /> },
      { path: 'dungeons', element: <DungeonsPage /> },
      { path: 'profile/:characterId', element: <ProfilePage /> },
    ],
  },
]);
