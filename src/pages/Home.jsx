import { Navigate } from 'react-router-dom';

// Fallback landing page; the authenticated application opens on Dashboard.


export default function Home() {
  return <Navigate to="/Dashboard" replace />;
}
