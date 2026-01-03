import { createRoot } from 'react-dom/client';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import routes from 'virtual:routes';

createRoot(document.getElementById('root')).render(
  <BrowserRouter children={useRoutes(routes)} />,
);
