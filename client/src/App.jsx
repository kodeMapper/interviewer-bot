import { Routes, Route } from 'react-router-dom';
import { InterviewProvider } from './context/InterviewContext';
import Landing from './pages/Landing';
import Setup from './pages/Setup';
import Interview from './pages/Interview';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';
import Admin from './pages/Admin';
import Complete from './pages/Complete';

function App() {
  return (
    <InterviewProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/interview/:sessionId" element={<Interview />} />
        <Route path="/interview/:sessionId/complete" element={<Complete />} />
        <Route path="/:username/dashboard" element={<Dashboard />} />
        <Route path="/report/:sessionId" element={<Report />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </InterviewProvider>
  );
}

export default App;
