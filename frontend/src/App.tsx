import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ConversationDetailPage } from './pages/ConversationDetail';
import { ConversationsPage } from './pages/Conversations';
import { DashboardPage } from './pages/Dashboard';
import { IncidentsPage } from './pages/Incidents';
import { ObservabilityPage } from './pages/Observability';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="conversations/:id" element={<ConversationDetailPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="observability" element={<ObservabilityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
