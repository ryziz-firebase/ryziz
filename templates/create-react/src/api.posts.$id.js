import { withExpress } from '@ryziz/functions';

export default withExpress((req, res) => {
  const { id } = req.params;
  res.json({ post: { id, title: `Post ${id}`, content: 'Demo content' } });
});
