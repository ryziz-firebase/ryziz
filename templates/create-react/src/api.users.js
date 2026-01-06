import { withExpress } from '@ryziz/functions';

export default withExpress((req, res) => {
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  res.json({ users });
});
