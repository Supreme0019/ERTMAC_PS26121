// =============================================================================
// NWIS Frontend — App Router
// =============================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/layout/Layout';

// Pages
import DashboardPage from './pages/Dashboard';
import WellsPage from './pages/Wells';
import WellDetailPage from './pages/WellDetail';
import MapPage from './pages/MapPage';
import DocumentsPage from './pages/DocumentsPage';
import SearchPage from './pages/SearchPage';
import RisksPage from './pages/RisksPage';
import AssistantPage from './pages/AssistantPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';
import ComparePage from './pages/ComparePage';
import { 
  WellCreatePage,
  WellEditPage
} from './pages/PlaceholderPages';
import RealtimePage from './pages/RealtimePage';
import SimulationPage from './pages/SimulationPage';
import PlanningPage from './pages/PlanningPage';
import DriftMonitoringPage from './pages/DriftMonitoringPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth (no layout) */}
            <Route path="/login" element={<LoginPage />} />

            {/* Main App (with layout, protected) */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="/wells" element={<WellsPage />} />
              <Route path="/wells/new" element={<WellCreatePage />} />
              <Route path="/wells/:id" element={<WellDetailPage />} />
              <Route path="/wells/:id/edit" element={<WellEditPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/risks" element={<RisksPage />} />
              <Route path="/realtime" element={<RealtimePage />} />
              <Route path="/simulation" element={<SimulationPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/drift" element={<DriftMonitoringPage />} />
              <Route path="/model-drift" element={<DriftMonitoringPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
