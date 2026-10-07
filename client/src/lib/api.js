import axios from 'axios';

export const TOKEN_KEY = 'flowboard.token';
export const REFRESH_Key='flowboard.refreshToken';
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// The current socket id travels with every write so the server can skip
// echoing the change back to the tab that made it.
let socketId = null;
export const setSocketId = (id) => { socketId = id; };
export const getSocketId = () => socketId;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (socketId) config.headers['x-socket-id'] = socketId;
  return config;
});
let refreshPromise=null;
async function doRefresh(){
  const refreshToken=localStorage.getItem(REFRESH_KEY);
  if(!refreshToken) throw new Error('no refresh token');
  const {data}=await axios.post(`${baseURl}/auth/refresh`,{refreshtoken});
  localStorage.setItem(TOKEN_KEY,data.accessToken);
  localStorage.setItem(REFRESH_KEY,data.refreshToken);
  return data.accessToken;

}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original=error.config;
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && !isAuthCall &&!original._retry) {
      original._retry=true;
      try{
        refreshPromise=refreshPromise || doRefresh(); 
      const newAcessToken=await refreshPromise;
    refreshPromise=null;
  original.headers.Authorization=`Bearer ${newAccessToken}`;
return api(original) ;
   }
   catch {
    refreshPromise=null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);

   }
      

      if (window.location.pathname !== '/login') window.location.assign('/login');

    }
    return Promise.reject(error);
  }
);

/** Turns any axios/network failure into a sentence worth showing a person. */
export function errorMessage(error, fallback = 'Something went wrong. Try again.') {
  const apiError = error?.response?.data?.error;
  if (apiError?.details?.length) return apiError.details[0].message || apiError.message;
  return apiError?.message || (error?.message === 'Network Error' ? 'Cannot reach the server.' : fallback);
}

export default api;
