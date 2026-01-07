import { useState, useEffect } from 'react';

export default function Index() {
  const [apiRoot, setApiRoot] = useState(null);
  const [users, setUsers] = useState([]);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/posts/1').then((r) => r.json()),
    ]).then(([root, usersData, postData]) => {
      setApiRoot(root);
      setUsers(usersData.users);
      setPost(postData.post);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>Welcome to Ryziz Firebase</h1>
      <p>Edit <code>src/pages.index.jsx</code> and save to reload.</p>

      <div style={{ marginTop: '30px' }}>
        <h2>API Demo</h2>

        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3>API Root (GET /api/)</h3>
          <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px' }}>
            {JSON.stringify(apiRoot, null, 2)}
          </pre>
        </div>

        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3>Users (GET /api/users)</h3>
          <ul style={{ textAlign: 'left' }}>
            {users.map((user) => (
              <li key={user.id}>{user.name}</li>
            ))}
          </ul>
        </div>

        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3>Post (GET /api/posts/1)</h3>
          <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px' }}>
            {JSON.stringify(post, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
