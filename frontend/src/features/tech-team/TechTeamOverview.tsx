import { Navigate } from 'react-router-dom';

export default function TechTeamOverview() {
  // Directly route Tech Team members to their projects view as their default overview
  return <Navigate to="/tech-team/projects" replace />;
}