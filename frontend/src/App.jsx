import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext'; 
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import Conversations from './components/Conversations/Conversations';
import Guests from './components/Guests/Guests';
import Tasks from './components/Tasks/Tasks';
import Rooms from './components/Rooms/Rooms';
import './App.css';

function App() {
  return (
    <LanguageProvider> 
      <DataProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/guests" element={<Guests />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/rooms" element={<Rooms />} />
            </Routes>
          </Layout>
        </Router>
      </DataProvider>
    </LanguageProvider>
  );
}

export default App;