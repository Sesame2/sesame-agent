import { Navigate } from 'react-router-dom';
import { getToken } from '../api/client';

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
