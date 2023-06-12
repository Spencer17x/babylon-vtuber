import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Vrm } from '@/pages/vrm';
import { Mmd } from '@/pages/mmd';

export const router = createBrowserRouter([
  {
    path: '/vrm',
    element: <Vrm/>
  },
  {
    path: '/mmd',
    element: <Mmd/>
  },
  {
    path: '*',
    element: <Navigate to="/vrm"/>
  }
]);
