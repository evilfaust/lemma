import { pb } from './client';
const base = '/api/lab-interval';
const idPath = (id) => encodeURIComponent(id);
async function request(path, method = 'GET', body) {
  try { return await pb.send(`${base}${path}`, { method, body, requestKey: null }); }
  catch (err) {
    if (err.response?.error) err.message = err.response.error;
    throw err;
  }
}
export const labIntervalsApi = {
  getLabIntervalWorks: () => request('/teacher'),
  createLabIntervalWork: (data) => request('/teacher', 'POST', data),
  getLabIntervalResults: (id) => request(`/teacher/${idPath(id)}`),
  setLabIntervalOpen: (id, isOpen) => request(`/teacher/${idPath(id)}/status`, 'POST', { isOpen }),
  getMyLabIntervals: () => request('/my'),
  getLabInterval: (id) => request(`/student/${idPath(id)}?version=2`),
  startLabInterval: (id) => request(`/student/${idPath(id)}/start?version=2`, 'POST', {}),
  actLabInterval: (id, data) => request(`/student/${idPath(id)}/action`, 'POST', data),
};
