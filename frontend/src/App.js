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
import CancelledTransfersPage from './pages/CancelledTransfersPage';
import TransitAccountPage from './pages/TransitAccountPage';
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

  return isAuthenticated ? children : <Navigate to="/login" />;
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><TransfersListPage /></ProtectedRoute>} />
      <Route path="/transfers/create" element={<ProtectedRoute><CreateTransferPage /></ProtectedRoute>} />
      <Route path="/transfers/:id" element={<ProtectedRoute><TransferDetailsPage /></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute><AgentsListPage /></ProtectedRoute>} />
      <Route path="/agents/add" element={<ProtectedRoute><AddAgentPage /></ProtectedRoute>} />
      <Route path="/agents/edit/:id" element={<ProtectedRoute><EditAgentPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/commissions" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />
      <Route path="/commissions-management" element={<ProtectedRoute><CommissionsManagementPage /></ProtectedRoute>} />
      <Route path="/admin/all-transfers" element={<ProtectedRoute><AllTransfersAdminPage /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
      <Route path="/wallet/manage" element={<ProtectedRoute><WalletManagementPage /></ProtectedRoute>} />
      <Route path="/transit-account" element={<ProtectedRoute><TransitAccountPage /></ProtectedRoute>} />
      <Route path="/statement" element={<ProtectedRoute><AgentStatementPage /></ProtectedRoute>} />
      <Route path="/statement/:agentId" element={<ProtectedRoute><AgentStatementPage /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
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