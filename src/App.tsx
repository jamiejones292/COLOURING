import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { Home } from './screens/Home';
import { Gallery } from './screens/Gallery';
import { Upload } from './screens/Upload';
import { Masterpieces } from './screens/Masterpieces';
import { Workspace } from './screens/Workspace';
import { requestPersistence } from './lib/storage';

export default function App() {
  const { path } = useRoute();
  useEffect(() => {
    requestPersistence();
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path.join('/')]);

  const [first, second] = path;
  if (first === 'pages') return <Gallery category={second} />;
  if (first === 'upload') return <Upload />;
  if (first === 'masterpieces') return <Masterpieces />;
  if (first === 'color' && second) return <Workspace key={'p' + second} pageId={second} />;
  if (first === 'project' && second) return <Workspace key={'j' + second} projectId={second} />;
  return <Home />;
}
