import { withExpress } from '@ryziz/functions';

export default withExpress((req, res) => {
  res.json({ message: 'API Root', method: req.method });
});
