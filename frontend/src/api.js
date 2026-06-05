import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
});

export default api;

// Membros
export const getMembers    = ()           => api.get('/members');
export const createMember  = (data)       => api.post('/members', data);
export const deleteMember  = (id)         => api.delete(`/members/${id}`);

// Professores
export const getTeachers   = ()           => api.get('/teachers');
export const createTeacher = (name)       => api.post('/teachers', { name });
export const deleteTeacher = (id)         => api.delete(`/teachers/${id}`);

// Aulas
export const getClasses    = ()           => api.get('/classes');
export const createClass   = (data)       => api.post('/classes', data);
export const updateClass   = (id, data)   => api.put(`/classes/${id}`, data);
export const deleteClass   = (id)         => api.delete(`/classes/${id}`);

// Check-ins
export const getCheckins   = (date)       => api.get(`/checkins?date=${date}`);
export const createCheckin = (data)       => api.post('/checkins', data);
export const deleteCheckin = (data)       => api.delete('/checkins', { data });

// Pagamentos
export const getPayments   = (month)      => api.get(`/payments?month=${month}`);
export const setPayment    = (data)       => api.post('/payments', data);