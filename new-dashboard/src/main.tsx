import { createRoot } from 'react-dom/client';
import App from './App';
import './assets/mdi-subset/materialdesignicons-subset.css';
import './styles/index.scss';

createRoot(document.getElementById('root')!).render(
  <App />,
);
