import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ProfilePage } from "./pages/ProfilePage";
import { DashboardPage } from "./pages/DashboardPage";
import { WorkoutsListPage } from "./pages/WorkoutsListPage";
import { CreateWorkoutPage } from "./pages/CreateWorkoutPage";
import { WorkoutDetailPage } from "./pages/WorkoutDetailPage";
import { EditWorkoutPage } from "./pages/EditWorkoutPage";
import { LogSessionPage } from "./pages/LogSessionPage";
import { SessionHistoryPage } from "./pages/SessionHistoryPage";
import { NotificationsPage } from "./pages/NotificationsPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/workouts" element={<WorkoutsListPage />} />
              <Route path="/workouts/new" element={<CreateWorkoutPage />} />
              <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
              <Route path="/workouts/:id/edit" element={<EditWorkoutPage />} />
              <Route path="/workouts/:id/log" element={<LogSessionPage />} />
              <Route path="/sessions" element={<SessionHistoryPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
