import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateTransferPage from './pages/CreateTransferPage';
import TransfersListPage from './pages/TransfersListPage';
import TransferDetailsPage from './pages/TransferDetailsPage';
import AgentsListPage from './pages/AgentsListPage';
import AddAgentPage from './pages/AddAgentPage';
import EditAgentPage from './pages/EditAgentPage';
import SettingsPage from './pages/SettingsPage';
import CommissionsPage from './pages/CommissionsPage';
import CommissionsManagementPage from './pages/CommissionsManagementPage';
import AllTransfersAdminPage from './pages/AllTransfersAdminPage';
import WalletPage from './pages/WalletPage';
import WalletManagementPage from './pages/WalletManagementPage';
import AgentStatementPage from './pages/AgentStatementPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AgentUsersPage from './pages/AgentUsersPage';
import CancelledTransfersPage from './pages/CancelledTransfersPage';
import TransitAccountPage from './pages/TransitAccountPage';
import AllCommissionsViewPage from './pages/AllCommissionsViewPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import ChartOfAccountsPage from './pages/ChartOfAccountsPageNew';
import TrialBalancePage from './pages/ChartOfAccountsPage'; // صفحة ميزان المراجعة
import ManualJournalEntryPage from './pages/ManualJournalEntryPage';
import JournalPage from './pages/JournalPage';
import LedgerPage from './pages/LedgerPage';
import JournalTransferPage from './pages/JournalTransferPage';
import ExchangeOperationsPage from './pages/ExchangeOperationsPage';
import PaidCommissionsPage from './pages/PaidCommissionsPage';
import AgentLedgerPage from './pages/AgentLedgerPage';
import AgentCommissionsPage from './pages/AgentCommissionsPage';
import QuickReceiveTransferPage from './pages/QuickReceiveTransferPage';
import CommissionsUnifiedPage from './pages/CommissionsUnifiedPage';
import CurrencyRevaluationPage from './pages/CurrencyRevaluationPage';
import BackupManagementPage from './pages/BackupManagementPage';
import TemplateDesignerPage from './pages/TemplateDesignerPage';
import VisualTemplateDesignerPage from './pages/VisualTemplateDesignerPage';
import UsersManagementPage from './pages/UsersManagementPage';
import Layout from './components/Layout';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-2xl text-primary font-bold">جاري التحميل...</div>
      </div>
    );
  }

  return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  // Determine redirect based on user role - always go to dashboard
  const getRedirectPath = () => {
    return '/dashboard';
  };

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={getRedirectPath()} /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><TransfersListPage /></ProtectedRoute>} />
      <Route path="/quick-receive" element={<ProtectedRoute><QuickReceiveTransferPage /></ProtectedRoute>} />
      <Route path="/transfers/create" element={<ProtectedRoute><CreateTransferPage /></ProtectedRoute>} />
      <Route path="/transfers/:id" element={<ProtectedRoute><TransferDetailsPage /></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute><AgentsListPage /></ProtectedRoute>} />
      <Route path="/agents/add" element={<ProtectedRoute><AddAgentPage /></ProtectedRoute>} />
      <Route path="/agents/edit/:id" element={<ProtectedRoute><EditAgentPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/commissions-unified" element={<ProtectedRoute><CommissionsUnifiedPage /></ProtectedRoute>} />
      <Route path="/commissions" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />
      <Route path="/commissions-management" element={<ProtectedRoute><CommissionsManagementPage /></ProtectedRoute>} />
      <Route path="/commissions-view" element={<ProtectedRoute><AllCommissionsViewPage /></ProtectedRoute>} />
      <Route path="/paid-commissions" element={<ProtectedRoute><PaidCommissionsPage /></ProtectedRoute>} />
      <Route path="/admin/all-transfers" element={<ProtectedRoute><AllTransfersAdminPage /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
      <Route path="/wallet/manage" element={<ProtectedRoute><WalletManagementPage /></ProtectedRoute>} />
      <Route path="/transit-account" element={<ProtectedRoute><TransitAccountPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/chart-of-accounts" element={<ProtectedRoute><ChartOfAccountsPage /></ProtectedRoute>} />
      <Route path="/trial-balance" element={<ProtectedRoute><TrialBalancePage /></ProtectedRoute>} />
      <Route path="/users-management" element={<ProtectedRoute><UsersManagementPage /></ProtectedRoute>} />
      <Route path="/manual-journal-entry" element={<ProtectedRoute><ManualJournalEntryPage /></ProtectedRoute>} />
      <Route path="/journal" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
      <Route path="/journal-transfer" element={<ProtectedRoute><JournalTransferPage /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><LedgerPage /></ProtectedRoute>} />
      <Route path="/agent-ledger" element={<ProtectedRoute><AgentLedgerPage /></ProtectedRoute>} />
      <Route path="/agent-commissions" element={<ProtectedRoute><AgentCommissionsPage /></ProtectedRoute>} />
      <Route path="/exchange" element={<ProtectedRoute><ExchangeOperationsPage /></ProtectedRoute>} />
      <Route path="/currency-revaluation" element={<ProtectedRoute><CurrencyRevaluationPage /></ProtectedRoute>} />
      <Route path="/backup-management" element={<ProtectedRoute><BackupManagementPage /></ProtectedRoute>} />
      <Route path="/designs" element={<ProtectedRoute><TemplateDesignerPage /></ProtectedRoute>} />
      <Route path="/visual-designer" element={<ProtectedRoute><VisualTemplateDesignerPage /></ProtectedRoute>} />
      <Route path="/statement" element={<ProtectedRoute><AgentStatementPage /></ProtectedRoute>} />
      <Route path="/statement/:agentId" element={<ProtectedRoute><AgentStatementPage /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/agent-users/:agentId" element={<ProtectedRoute><AgentUsersPage /></ProtectedRoute>} />
      <Route path="/admin/cancelled-transfers" element={<ProtectedRoute><CancelledTransfersPage /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <WebSocketProvider>
            <AppRoutes />
            <Toaster position="top-center" richColors />
          </WebSocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;