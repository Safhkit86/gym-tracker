import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { WorkoutsListPage } from "./pages/WorkoutsListPage";
import { CreateWorkoutPage } from "./pages/CreateWorkoutPage";
import { WorkoutDetailPage } from "./pages/WorkoutDetailPage";
import { LogSessionPage } from "./pages/LogSessionPage";
import { SessionHistoryPage } from "./pages/SessionHistoryPage";
import { SessionDetailPage } from "./pages/SessionDetailPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/workouts" element={<WorkoutsListPage />} />
              <Route path="/workouts/new" element={<CreateWorkoutPage />} />
              <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
              <Route path="/workouts/:id/log" element={<LogSessionPage />} />
              <Route path="/sessions" element={<SessionHistoryPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
