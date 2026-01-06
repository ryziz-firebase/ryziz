import { withExpress } from '@ryziz/functions';

export const config = {
  memory: '1GiB',
  timeoutSeconds: 300,
};

export default withExpress((req, res) => {
  res.json({ message: 'Upload endpoint', uploaded: true });
});
