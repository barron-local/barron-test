'use client';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const getApiUrl = (path) => {
    if (typeof window !== 'undefined') return `http://${window.location.hostname}:5000${path}`;
    return `http://localhost:5000${path}`;
  };

  // State เข้าสู่ระบบ
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);

  // State ข้อมูลและตัวค้นหา/Filter
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState('');

  // State เพิ่มผู้ใช้ (Admin)
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('readonly');

  // State แก้ไขผู้ใช้ (Admin, Editonly)
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editFile, setEditFile] = useState(null);

  // แจ้งเตือนข้อความ
  const [msg, setMsg] = useState({ text: '', isError: false });
  const notify = (text, isError = false) => {
    setMsg({ text, isError });
    setTimeout(() => setMsg({ text: '', isError: false }), 4000);
  };

  const uploadInputRef = useRef(null);

  // 1. ดึงข้อมูลผู้ใช้ (รองรับ Search & Filter)
  const fetchUsers = async (s = search, r = role, st = state) => {
    try {
      const q = new URLSearchParams();
      if (s) q.append('search', s);
      if (r) q.append('role', r);
      if (st) q.append('state', st);

      const res = await fetch(getApiUrl(`/api/users?${q.toString()}`), {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (res.ok) setUsers(await res.json());
      else if (res.status === 401) handleLogout();
    } catch {
      notify('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', true);
    }
  };

  // โหลด token เก่าเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  // เมื่อ user มีการ login สำเร็จ ให้โหลดตาราง
  useEffect(() => {
    if (user?.token) fetchUsers();
  }, [user]);

  // 2. ฟังก์ชัน Login / Logout
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
      } else {
        notify(data.message || 'เข้าสู่ระบบไม่สำเร็จ', true);
      }
    } catch {
      notify('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', true);
    }
  };

  const handleLogout = async () => {
    try {
      if (user?.token) {
        await fetch(getApiUrl('/api/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` }
        });
      }
    } catch {
      // ละเว้น error ในกรณีต่อเน็ตไม่ได้
    } finally {
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  // 3. ฟังก์ชัน เพิ่มผู้ใช้ (เฉพาะ Admin)
  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await fetch(getApiUrl('/api/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ username: newName, password: newPassword, role: newRole })
    });
    if (res.ok) {
      setNewName(''); setNewPassword('');
      notify('เพิ่มผู้ใช้สำเร็จ');
      fetchUsers();
    } else {
      notify('เพิ่มผู้ใช้ไม่สำเร็จ', true);
    }
  };

  // 4. ฟังก์ชัน แก้ไขผู้ใช้ (Admin, Editonly)
  const handleEdit = async (id) => {
    const formData = new FormData();
    formData.append('username', editName);
    if (editFile) formData.append('file', editFile);

    const res = await fetch(getApiUrl(`/api/users/${id}`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user.token}` },
      body: formData
    });
    if (res.ok) {
      setEditId(null); setEditFile(null);
      notify('แก้ไขข้อมูลสำเร็จ');
      fetchUsers();
    } else {
      notify('แก้ไขไม่สำเร็จ', true);
    }
  };

  // 5. ฟังก์ชัน ลบผู้ใช้ (เฉพาะ Admin)
  const handleDelete = async (id) => {
    if (!confirm('ยืนยันที่จะลบข้อมูลนี้หรือไม่?')) return;
    const res = await fetch(getApiUrl(`/api/users/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user.token}` }
    });
    if (res.ok) {
      notify('ลบข้อมูลสำเร็จ');
      fetchUsers();
    } else {
      notify('ลบไม่สำเร็จ', true);
    }
  };

  // 6. อัปโหลดไฟล์ส่วนตัว
  const handleUploadSelf = async (file) => {
    if (!file || !user?.id) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(getApiUrl(`/api/users/${user.id}/upload`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: formData
    });
    if (res.ok) {
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      notify('อัปโหลดไฟล์สำเร็จ');
      fetchUsers();
    }
  };

  // --- หน้าจอ 1: หากยังไม่ล็อกอิน ---
  if (!user) {
    return (
      <div className="login-box card">
        <h2 style={{ textAlign: 'center' }}>เข้าสู่ระบบ</h2>
        {msg.text && <div className={msg.isError ? "alert-error" : "alert-success"}>{msg.text}</div>}
        <form onSubmit={handleLogin} className="form-col">
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="btn-primary">Login</button>
        </form>
      </div>
    );
  }

  // --- กำหนดระดับสิทธิ์ (จำง่ายๆ) ---
  const isAdmin = user.role === 'admin';
  const canEdit = user.role === 'admin' || user.role === 'editonly';

  // --- หน้าจอ 2: ระบบจัดการผู้ใช้ ---
  return (
    <div className="container">
      <div className="card">
        {/* หัวเว็บ + สิทธิ์ */}
        <div className="header">
          <div>
            <h2 style={{ margin: 0 }}>ระบบจัดการผู้ใช้</h2>
            <small>ผู้ใช้: <b>{user.username}</b> | สิทธิ์: <b style={{ color: isAdmin ? 'red' : 'blue' }}>{user.role}</b></small>
          </div>
          <button onClick={handleLogout} className="btn-danger">ออกจากระบบ</button>
        </div>

        {msg.text && <div className={msg.isError ? "alert-error" : "alert-success"} style={{ margin: '10px 0' }}>{msg.text}</div>}

        {/* 1. ส่วนเพิ่มผู้ใช้ใหม่ (แสดงเฉพาะ Admin) */}
        {isAdmin && (
          <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, margin: '15px 0' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>เพิ่มผู้ใช้ใหม่</h4>
            <form onSubmit={handleCreate} className="form-row" style={{ gap: 8 }}>
              <input placeholder="Username" value={newName} onChange={e => setNewName(e.target.value)} required />
              <input type="password" placeholder="Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="readonly">readonly</option>
                <option value="editonly">editonly</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" className="btn-success">เพิ่มผู้ใช้</button>
            </form>
          </div>
        )}

        {/* 2. ส่วนแถบค้นหา & Filter ตามสิทธิ์ */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '15px 0', background: '#f3f4f6', padding: 10, borderRadius: 6 }}>
          {/* ทุกสิทธิ์ ค้นหาชื่อได้ */}
          <input placeholder="ค้นหาชื่อผู้ใช้..." value={search} onChange={e => setSearch(e.target.value)} />

          {/* เฉพาะ Admin ที่เห็น Filter Role */}
          {isAdmin && (
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="">ทุก Role</option>
              <option value="admin">admin</option>
              <option value="editonly">editonly</option>
              <option value="readonly">readonly</option>
            </select>
          )}

          {/* Admin และ Editonly ที่เห็น Filter สถานะ */}
          {canEdit && (
            <select value={state} onChange={e => setState(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              <option value="on">on</option>
              <option value="off">off</option>
            </select>
          )}

          <button onClick={() => fetchUsers(search, role, state)} className="btn-primary">ค้นหา</button>
          {(search || role || state) && (
            <button onClick={() => { setSearch(''); setRole(''); setState(''); fetchUsers('', '', ''); }}>ล้างตัวกรอง</button>
          )}
        </div>

        {/* อัปโหลดไฟล์ส่วนตัว */}
        <div style={{ margin: '10px 0' }}>
          <small>อัปโหลดไฟล์ของคุณ: </small>
          <input type="file" ref={uploadInputRef} onChange={e => handleUploadSelf(e.target.files[0])} />
        </div>

        {/* 3. ตารางข้อมูลผู้ใช้ */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>ชื่อผู้ใช้</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
                <th>ไฟล์แนบ</th>
                {canEdit && <th>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    {editId === u.id ? <input value={editName} onChange={e => setEditName(e.target.value)} /> : u.username}
                  </td>
                  <td>{u.role}</td>
                  <td>{u.state || 'off'}</td>
                  <td>
                    {editId === u.id ? (
                      <input type="file" onChange={e => setEditFile(e.target.files[0])} />
                    ) : (
                      u.filename ? <a href={getApiUrl(`/uploads/${u.filename}`)} target="_blank">{u.filename}</a> : '-'
                    )}
                  </td>
                  {/* ปุ่ม Action ตามสิทธิ์ */}
                  {canEdit && (
                    <td>
                      {editId === u.id ? (
                        <>
                          <button onClick={() => handleEdit(u.id)} className="btn-success">บันทึก</button>
                          <button onClick={() => setEditId(null)}>ยกเลิก</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(u.id); setEditName(u.username); }} className="btn-warning">แก้ไข</button>
                          {isAdmin && <button onClick={() => handleDelete(u.id)} className="btn-danger" style={{ marginLeft: 4 }}>ลบ</button>}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
