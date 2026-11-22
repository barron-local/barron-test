'use client';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const getApiUrl = (path) => {
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol;
      const host = window.location.hostname;
      // ถ้าเปิดผ่านโดเมน https://frontend.mydomain.lab ให้ยิงไปที่ https://backend.mydomain.lab
      if (host.includes('frontend.')) {
        return `${proto}//${host.replace('frontend.', 'backend.')}${path}`;
      }
      // ถ้าเปิดผ่าน IP หรือชื่ออื่น
      if (proto === 'https:') {
        return `${proto}//${host}${path}`;
      }
      return `${proto}//${host}:5000${path}`;
    }
    return `http://localhost:5000${path}`;
  };

  // 1. State สำหรับระบบ Authentication, รายการข้อมูลผู้ใช้, ฟอร์มเพิ่ม/แก้ไข และการแจ้งเตือน
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState('');

  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('readonly');

  // State สำหรับกล่องแยกอัปโหลดไฟล์ (Admin และ Editonly แนบให้ตนเอง)
  const [standaloneFile, setStandaloneFile] = useState(null);
  const standaloneFileInputRef = useRef(null);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('readonly');
  const [editFile, setEditFile] = useState(null);

  const [msg, setMsg] = useState({ text: '', isError: false });

  // 2. ฟังก์ชันจัดการข้อความแจ้งเตือน และแปลง Error Code จาก Backend
  const handleBackendError = (statusCode, backendMessage) => {
    if (backendMessage) return backendMessage;
    if (statusCode === 400) return 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
    if (statusCode === 401) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือ Token หมดอายุ';
    if (statusCode === 403) return 'คุณไม่มีสิทธิ์ในการทำรายการนี้ (Permission Denied)';
    if (statusCode === 404) return 'ไม่พบข้อมูลที่ต้องการในระบบ';
    if (statusCode === 500) return 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง';
    return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  };

  const notify = (text, isError = false) => {
    setMsg({ text, isError });
    setTimeout(() => setMsg({ text: '', isError: false }), 4500);
  };

  // 3. ฟังก์ชันดึงรายการข้อมูลผู้ใช้ (รองรับ Search & Filter ตามระดับสิทธิ์)
  const fetchUsers = async (s = search, r = role, st = state) => {
    if (!user?.token) return;
    try {
      const q = new URLSearchParams();
      if (s) q.append('search', s);
      if (r) q.append('role', r);
      if (st) q.append('state', st);

      const res = await fetch(getApiUrl(`/api/users?${q.toString()}`), {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      const resData = await res.json();
      if (res.ok) {
        const list = Array.isArray(resData) ? resData : (resData.data || []);
        setUsers(list);
      } else {
        if (res.status === 401) {
          handleLogout(true);
        } else {
          notify(handleBackendError(res.status, resData.message), true);
        }
      }
    } catch (err) {
      notify('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Backend ได้', true);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    if (user?.token) {
      fetchUsers();
    }
  }, [user]);

  // 4. ฟังก์ชันเข้าสู่ระบบ (Login) และออกจากระบบ (Logout) ด้วย JWT
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      notify('กรุณากรอก Username และ Password ให้ครบถ้วน', true);
      return;
    }

    try {
      const res = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
        notify('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ');
      } else {
        notify(handleBackendError(res.status, data.message), true);
      }
    } catch (err) {
      notify('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อเข้าสู่ระบบได้', true);
    }
  };

  const handleLogout = async (skipConfirm = false) => {
    if (skipConfirm !== true && typeof window !== 'undefined') {
      const isConfirmed = window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?');
      if (!isConfirmed) return;
    }
    try {
      if (user?.token) {
        await fetch(getApiUrl('/api/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` }
        });
      }
    } catch (e) {
    } finally {
      localStorage.removeItem('user');
      setUser(null);
      setUsers([]);
      notify('ออกจากระบบสำเร็จ');
    }
  };

  // 5. ฟังก์ชันเพิ่มผู้ใช้ใหม่ (เฉพาะ Admin)
  const handleCreate = async (e) => {
    e.preventDefault();

    if (!newName.trim()) {
      notify('กรุณากรอกชื่อผู้ใช้ (Username)', true);
      return;
    }
    if (!newPassword.trim() || newPassword.length < 4) {
      notify('กรุณากรอกรหัสผ่านอย่างน้อย 4 ตัวอักษร', true);
      return;
    }

    try {
      const res = await fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          username: newName.trim(),
          password: newPassword.trim(),
          role: newRole
        })
      });
      const data = await res.json();

      if (res.ok) {
        setNewName('');
        setNewPassword('');
        notify('เพิ่มผู้ใช้ใหม่สำเร็จ');
        fetchUsers();
      } else {
        notify(handleBackendError(res.status, data.message), true);
      }
    } catch (err) {
      notify('เกิดข้อผิดพลาดในการบันทึกข้อมูล', true);
    }
  };

  // 5.1 ฟังก์ชันแยกสำหรับอัปโหลดและแนบไฟล์ให้บัญชีตนเอง (เฉพาะ Admin และ Editonly)
  const handleStandaloneUpload = async (e) => {
    e.preventDefault();

    if (!standaloneFile) {
      notify('กรุณาเลือกไฟล์ที่ต้องการอัปโหลด', true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', standaloneFile);

      const res = await fetch(getApiUrl(`/api/users/${user.id}/upload`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setStandaloneFile(null);
        if (standaloneFileInputRef.current) standaloneFileInputRef.current.value = '';
        notify('อัปโหลดและแนบไฟล์ข้อมูลเข้าสู่บัญชีของคุณสำเร็จ');
        fetchUsers();
      } else {
        notify(handleBackendError(res.status, data.message), true);
      }
    } catch (err) {
      notify('เกิดข้อผิดพลาดในการอัปโหลดไฟล์', true);
    }
  };

  // 6. ฟังก์ชันแก้ไขข้อมูลผู้ใช้และไฟล์แนบเดิม (Admin หรือ Editonly)
  const handleEdit = async (id) => {
    if (!editName.trim()) {
      notify('ชื่อผู้ใช้ไม่สามารถเว้นว่างได้', true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('username', editName.trim());
      if (isAdmin) formData.append('role', editRole);
      if (editFile) formData.append('file', editFile);

      const res = await fetch(getApiUrl(`/api/users/${id}`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setEditId(null);
        setEditFile(null);
        notify('แก้ไขและปรับปรุงข้อมูลพร้อมไฟล์แนบสำเร็จ');
        fetchUsers();
      } else {
        notify(handleBackendError(res.status, data.message), true);
      }
    } catch (err) {
      notify('เกิดข้อผิดพลาดในการแก้ไขข้อมูล', true);
    }
  };

  // 7. ฟังก์ชันลบข้อมูลผู้ใช้พร้อมกล่องยืนยัน (Confirmation Dialog)
  const handleDelete = async (id, targetUsername) => {
    const isConfirmed = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลผู้ใช้ "${targetUsername}" ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`);
    if (!isConfirmed) return;

    try {
      const res = await fetch(getApiUrl(`/api/users/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();

      if (res.ok) {
        notify('ลบข้อมูลสำเร็จ');
        fetchUsers();
      } else {
        notify(handleBackendError(res.status, data.message), true);
      }
    } catch (err) {
      notify('เกิดข้อผิดพลาดในการลบข้อมูล', true);
    }
  };

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'editonly';

  // หน้าจอที่ 1: เข้าสู่ระบบ (Login Screen)
  if (!user) {
    return (
      <div className="login-box card">
        <h2 className="login-title">เข้าสู่ระบบ (Login)</h2>
        {msg.text && (
          <div className={msg.isError ? "alert-error" : "alert-success"}>
            {msg.text}
          </div>
        )}
        <form onSubmit={handleLogin} className="form-col">
          <div>
            <label className="form-label">Username</label>
            <input
              type="text"
              className="full-width"
              placeholder="กรอกชื่อผู้ใช้..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="full-width"
              placeholder="กรอกรหัสผ่าน..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary login-submit-btn">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    );
  }

  // หน้าจอที่ 2: ระบบบริหารจัดการผู้ใช้ (Dashboard)
  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div>
            <h2 className="header-title">ระบบบริหารจัดการผู้ใช้ (User Management)</h2>
            <small className="user-info">
              ผู้ใช้งานปัจจุบัน: <b>{user.username}</b> |
              ระดับสิทธิ์: <b className={isAdmin ? 'role-admin' : (canEdit ? 'role-editonly' : 'role-readonly')}>{user.role}</b>
            </small>
          </div>
          <button onClick={() => handleLogout(false)} className="btn-danger">
            ออกจากระบบ (Logout)
          </button>
        </div>

        {msg.text && (
          <div className={msg.isError ? "alert-error" : "alert-success"}>
            {msg.text}
          </div>
        )}

        {/* 1. กล่องเพิ่มผู้ใช้ใหม่ (เฉพาะ Admin) */}
        {isAdmin && (
          <div className="admin-create-box">
            <h4 className="admin-create-title">เพิ่มผู้ใช้ใหม่</h4>
            <form onSubmit={handleCreate} className="form-row">
              <input
                placeholder="ชื่อผู้ใช้ (Username)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="รหัสผ่าน (Password)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="readonly">readonly (ดูได้อย่างเดียว)</option>
                <option value="editonly">editonly (แก้ไขได้)</option>
                <option value="admin">admin (ผู้ดูแลระบบ)</option>
              </select>
              <button type="submit" className="btn-success">
                บันทึกผู้ใช้
              </button>
            </form>
          </div>
        )}

        {/* 2. กล่องแยกอัปโหลดและแนบไฟล์ข้อมูล (เฉพาะ Admin และ Editonly - แนบเข้าบัญชีตนเอง) */}
        {canEdit && (
          <div className="admin-create-box" style={{ marginTop: '1rem' }}>
            <h4 className="admin-create-title">อัปโหลดและแนบไฟล์ข้อมูล (แนบเข้าบัญชี: {user?.username})</h4>
            <form onSubmit={handleStandaloneUpload} className="form-row">
              <div>
                <input
                  type="file"
                  ref={standaloneFileInputRef}
                  onChange={e => setStandaloneFile(e.target.files[0])}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">
                อัปโหลดไฟล์
              </button>
            </form>
          </div>
        )}

        {/* ระบบค้นหาและกรองข้อมูล */}
        <div className="filter-bar">
          <input
            placeholder="ค้นหาชื่อผู้ใช้ (Search)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {isAdmin && (
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="">ทุกระดับบทบาท (All Roles)</option>
              <option value="admin">admin</option>
              <option value="editonly">editonly</option>
              <option value="readonly">readonly</option>
            </select>
          )}

          {canEdit && (
            <select value={state} onChange={e => setState(e.target.value)}>
              <option value="">ทุกสถานะ (All Status)</option>
              <option value="on">ออนไลน์ (on)</option>
              <option value="off">ออฟไลน์ (off)</option>
            </select>
          )}

          <button onClick={() => fetchUsers(search, role, state)} className="btn-primary">
            ค้นหาข้อมูล
          </button>
          {(search || role || state) && (
            <button
              onClick={() => {
                setSearch('');
                setRole('');
                setState('');
                fetchUsers('', '', '');
              }}
              className="btn-outline"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* ตารางแสดงผลรายการข้อมูลผู้ใช้ */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>ชื่อผู้ใช้</th>
                <th>บทบาท (Role)</th>
                <th>สถานะ</th>
                <th>ประวัติเข้าใช้งานล่าสุด</th>
                <th>ไฟล์แนบ</th>
                {canEdit && <th>การจัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="table-empty-cell">
                    ไม่พบรายการข้อมูลผู้ใช้
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>
                      {editId === u.id ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                        />
                      ) : (
                        u.username
                      )}
                    </td>
                    <td>
                      {editId === u.id && isAdmin ? (
                        <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                          <option value="readonly">readonly</option>
                          <option value="editonly">editonly</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span className="role-text">{u.role}</span>
                      )}
                    </td>
                    <td>
                      <span className={u.state === 'on' ? 'badge-online' : 'badge-offline'}>
                        {u.state === 'on' ? 'online' : 'offline'}
                      </span>
                    </td>
                    <td>{u.logged_at ? new Date(u.logged_at).toLocaleString('th-TH') : '-'}</td>
                    <td>
                      {editId === u.id ? (
                        <div>
                          <input
                            type="file"
                            onChange={e => setEditFile(e.target.files[0])}
                          />
                          {u.filename && <div className="file-hint">ไฟล์เดิม: {u.filename}</div>}
                        </div>
                      ) : (
                        u.filename ? (
                          <a href={getApiUrl(`/uploads/${u.filename}`)} target="_blank" rel="noreferrer" className="file-link">
                            {u.filename}
                          </a>
                        ) : (
                          <span className="file-empty">-</span>
                        )
                      )}
                    </td>

                    {canEdit && (
                      <td>
                        {editId === u.id ? (
                          <div className="action-btn-group">
                            <button onClick={() => handleEdit(u.id)} className="btn-success">บันทึก</button>
                            <button onClick={() => { setEditId(null); setEditFile(null); }} className="btn-outline">ยกเลิก</button>
                          </div>
                        ) : (
                          <div className="action-btn-group">
                            <button
                              onClick={() => {
                                setEditId(u.id);
                                setEditName(u.username);
                                setEditRole(u.role);
                              }}
                              className="btn-warning"
                            >
                              แก้ไข
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(u.id, u.username)}
                                className="btn-danger"
                              >
                                ลบ
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
