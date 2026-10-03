// src/App.jsx
import './App.css';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import FirebaseLogin from '@/auth/FirebaseLogin';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import NavigationTracker from '@/lib/NavigationTracker';
import PageNotFound from '@/lib/PageNotFound';
import VisualEditAgent from '@/lib/VisualEditAgent';
import { queryClientInstance } from '@/lib/query-client';
import { pagesConfig } from './pages.config';

const loginPortalEnabled =
  import.meta.env.VITE_LOGIN_PORTAL_ENABLED === 'true';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? (
    <Layout currentPageName={currentPageName}>{children}</Layout>
  ) : (
    <>{children}</>
  );

function AuthenticatedApp() {
  const { isLoadingAuth, authError, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authError?.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return <FirebaseLogin />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        }
      />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function BuildInProgress() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.20),_transparent_42%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
        <section className="w-full max-w-xl rounded-3xl border border-slate-700/70 bg-slate-900/90 px-8 py-12 text-center shadow-2xl shadow-blue-950/40 backdrop-blur-xl sm:px-12">
          <img
            src="/images/mdx-fuel-atlas-logo.png"
            alt="MDX Fuel ATLAS CRM"
            className="mx-auto h-auto w-full max-w-xs"
          />
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-400">
            MDX Fuel
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            ATLAS CRM is being built
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-300">
            The employee portal is temporarily unavailable while development
            and validation are completed. Please check back after launch.
          </p>
        </section>
      </div>
    </main>
  );
}

function App() {
  if (!loginPortalEnabled) {
    return <BuildInProgress />;
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
