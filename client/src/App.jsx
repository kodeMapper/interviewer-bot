import { Routes, Route } from 'react-router-dom';
import { InterviewProvider } from './context/InterviewContext';
import Header from './components/Header';
import Home from './pages/Home';
import Interview from './pages/Interview';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';

function App() {
  return (
    <InterviewProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/interview/:sessionId" element={<Interview />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report/:sessionId" element={<Report />} />
          </Routes>
        </main>
      </div>
    </InterviewProvider>
  );
}

export default App;
