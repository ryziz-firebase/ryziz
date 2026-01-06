import { withExpress } from '@ryziz/functions';

export default withExpress((req, res) => {
  res.json({ message: 'Upload endpoint', uploaded: true });
}, {
  memory: '1GiB',
  timeoutSeconds: 300,
});
