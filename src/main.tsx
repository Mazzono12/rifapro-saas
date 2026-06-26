import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './styles/themes/theme-vars.css';
import './index.css';
import './styles/admin-ui.css';
import { registerCifherServiceWorker } from './pwa/registerPwa';

const queryClient = new QueryClient();

void registerCifherServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
