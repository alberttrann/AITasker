import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useSearchData(isAuthenticated: boolean, activeRole: string) {
  const { data: rawProjects } = useQuery({
    queryKey: ['projects', { slim: true }],
    queryFn: async () => {
      const res = await apiClient.get('/projects?slim=true');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'CLIENT_CEO',
  });

  const { data: rawServices } = useQuery({
    queryKey: ['services', { limit: 30 }],
    queryFn: async () => {
      const res = await apiClient.get('/services', { params: { limit: 30 } });
      return res.data;
    },
    enabled: isAuthenticated && (activeRole === 'CLIENT_CEO' || activeRole === 'EXPERT'),
  });

  const { data: rawEngagements } = useQuery({
    queryKey: ['engagements'],
    queryFn: async () => {
      const res = await apiClient.get('/engagements');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'EXPERT',
  });

  const { data: rawInvitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const res = await apiClient.get('/invitations');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'EXPERT',
  });

  const { data: rawTechEngagements } = useQuery({
    queryKey: ['engagements', 'tech-team'],
    queryFn: async () => {
      const res = await apiClient.get('/engagements/tech-team');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'TECH_TEAM',
  });

  const { data: adminUsersData } = useQuery({
    queryKey: ['admin', 'users', 1, 30],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users', { params: { page: 1, limit: 30 } });
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'ADMIN',
  });

  const { data: rawAdminDisputes } = useQuery({
    queryKey: ['admin', 'disputes', undefined],
    queryFn: async () => {
      const res = await apiClient.get('/admin/disputes');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'ADMIN',
  });

  return {
    rawProjects,
    rawServices,
    rawEngagements,
    rawInvitations,
    rawTechEngagements,
    adminUsersData,
    rawAdminDisputes,
  };
}
