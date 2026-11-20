'use client';
import { useState, useEffect, useRef } from 'react';

// ====================================================================================
// การพัฒนาระบบฝั่งหน้าบ้าน (Front-end Development)
// หัวข้อหลัก: การสร้าง Web Application ด้วย React / Next.js
// ====================================================================================

export default function Home() {
  // ฟังก์ชันช่วยเหลือสำหรับเรียก API
  const getApiUrl = (path) => {
    if (typeof window !== 'undefined') return `http://${window.location.hostname}:5000${path}`;
    return `http://localhost:5000${path}`;
  };

  // ----------------------------------------------------------------------------------
  // 1. State สำหรับระบบเข้าสู่ระบบ (Authentication ด้วย JWT)
  // ----------------------------------------------------------------------------------
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);

  // ----------------------------------------------------------------------------------
  // 2. State สำหรับค้นหาและกรองข้อมูล (Search & Filter)
  // ----------------------------------------------------------------------------------
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState('');

  // ----------------------------------------------------------------------------------
  // 3. State สำหรับฟอร์มเพิ่มข้อมูลพร้อมแนบไฟล์ (Create Form)
  // ----------------------------------------------------------------------------------
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('readonly');
  const [newFile, setNewFile] = useState(null);
  const newFileInputRef = useRef(null);

  // ----------------------------------------------------------------------------------
  // 4. State สำหรับฟอร์มแก้ไขข้อมูลและแก้ไขไฟล์แนบเดิม (Edit Form)
  // ----------------------------------------------------------------------------------
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('readonly');
  const [editFile, setEditFile] = useState(null);

  // ----------------------------------------------------------------------------------
  // 5. State สำหรับ Error Handling & Alert Notification
  // ----------------------------------------------------------------------------------
  const [msg, setMsg] = useState({ text: '', isError: false });

  /**
   * มีการทำ Error Handling ฝั่ง Frontend:
   * แปลงรหัส Error จาก Backend เป็นข้อความที่ผู้ใช้เข้าใจง่าย
   */
  const handleBackendError = (statusCode, backendMessage) => {
    if (statusCode === 400) return backendMessage || 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
    if (statusCode === 401) return 'กรุณาเข้าสู่ระบบก่อนทำรายการ หรือ Token หมดอายุ';
    if (statusCode === 403) return 'คุณไม่มีสิทธิ์ในการทำรายการนี้ (Permission Denied)';
    if (statusCode === 404) return 'ไม่พบข้อมูลที่ต้องการในระบบ';
    if (statusCode === 500) return 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง';
    return backendMessage || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  };

  const notify = (text, isError = false) => {
    setMsg({ text, isError });
    setTimeout(() => setMsg({ text: '', isError: false }), 4500);
  };

  // ----------------------------------------------------------------------------------
  // 6. ฟังก์ชันดึงข้อมูลผู้ใช้ (รองรับ Search & Filter ตามสิทธิ์)
  // ----------------------------------------------------------------------------------
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
          handleLogout();
        } else {
          notify(handleBackendError(res.status, resData.message), true);
        }
      }
    } catch (err) {
      notify('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Backend ได้', true);
    }
  };

  // ตรวจสอบ JWT Token จาก localStorage เมื่อโหลดหน้าเว็บครั้งแรก
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

  // เมื่อผู้ใช้ล็อกอินสำเร็จ ให้โหลดข้อมูลผู้ใช้ตามระดับสิทธิ์
  useEffect(() => {
    if (user?.token) {
      fetchUsers();
    }
  }, [user]);

  // ----------------------------------------------------------------------------------
  // 7. พัฒนาหน้าจอและระบบ Login หรือ Authentication ด้วย JWT ที่ใช้งานได้จริง
  // ----------------------------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();

    // Form Validation ฝั่ง Frontend
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

  const handleLogout = async () => {
    try {
      if (user?.token) {
        await fetch(getApiUrl('/api/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` }
        });
      }
    } catch (e) {
      // ละเว้นข้อผิดพลาดกรณีเครือข่ายหลุด
    } finally {
      localStorage.removeItem('user');
      setUser(null);
      setUsers([]);
      notify('ออกจากระบบสำเร็จ');
    }
  };

  // ----------------------------------------------------------------------------------
  // 8. หน้าฟอร์มสำหรับเพิ่มข้อมูลได้สมบูรณ์ พร้อมฟังก์ชันแนบไฟล์ข้อมูล
  // ----------------------------------------------------------------------------------
  const handleCreate = async (e) => {
    e.preventDefault();

    // มีการ Validate ข้อมูลฝั่ง Frontend ก่อนส่งไปยัง Backend
    if (!newName.trim()) {
      notify('กรุณากรอกชื่อผู้ใช้ (Username)', true);
      return;
    }
    if (!newPassword.trim() || newPassword.length < 4) {
      notify('กรุณากรอกรหัสผ่านอย่างน้อย 4 ตัวอักษร', true);
      return;
    }

    try {
      // 8.1 ส่งข้อมูล Request Body สร้างผู้ใช้ใหม่
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
        const createdId = data.id || data.data?.id;

        // 8.2 มีการแนบไฟล์พร้อมกับเพิ่มข้อมูลได้สมบูรณ์ (ถ้ามีการเลือกไฟล์)
        if (newFile && createdId) {
          const formData = new FormData();
          formData.append('file', newFile);
          await fetch(getApiUrl(`/api/users/${createdId}/upload`), {
            method: 'POST',
            headers: { Authorization: `Bearer ${user.token}` },
            body: formData
          });
        }

        setNewName('');
        setNewPassword('');
        setNewFile(null);
        if (newFileInputRef.current) newFileInputRef.current.value = '';
        notify('บันทึกข้อมูลและแนบไฟล์สำเร็จ');
        fetchUsers();
      } else {
        notify(handleBackendError(res.status, data.message), true);
      }
    } catch (err) {
      notify('เกิดข้อผิดพลาดในการบันทึกข้อมูล', true);
    }
  };

  // ----------------------------------------------------------------------------------
  // 9. หน้าจัดการข้อมูล: สามารถแก้ไขข้อมูล และแก้ไขไฟล์แนบเดิมได้
  // ----------------------------------------------------------------------------------
  const handleEdit = async (id) => {
    // Validate ข้อมูลฝั่ง Frontend
    if (!editName.trim()) {
      notify('ชื่อผู้ใช้ไม่สามารถเว้นว่างได้', true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('username', editName.trim());
      if (isAdmin) formData.append('role', editRole);
      // มีการแก้ไขไฟล์แนบที่เกี่ยวข้องกับข้อมูลได้
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

  // ----------------------------------------------------------------------------------
  // 10. มีกล่องข้อความยืนยัน/แจ้งเตือนก่อนการลบข้อมูล (Confirmation Dialog)
  // ----------------------------------------------------------------------------------
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

  // ----------------------------------------------------------------------------------
  // 11. จัดการสิทธิ์การเข้าใช้งาน (Role-based UI) โดยแยกหน้าจอและการเข้าถึงตามสิทธิ์ใน JWT
  // ----------------------------------------------------------------------------------
  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'editonly';

  // ==================================================================================
  // หน้าจอที่ 1: หน้าจอเข้าสู่ระบบ (Login Screen) เมื่อยังไม่มี Session Token
  // ==================================================================================
  if (!user) {
    return (
      <div className="login-box card">
        <h2 className="login-title">เข้าสู่ระบบ (Login)</h2>
        {/* UI แสดงการแจ้งเตือน Error / Success */}
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

  // ==================================================================================
  // หน้าจอที่ 2: ระบบบริหารจัดการข้อมูล (Dashboard / Role-based UI)
  // ==================================================================================
  return (
    <div className="container">
      <div className="card">
        {/* หัวหน้าเว็บ: แสดงข้อมูลผู้ใช้และสิทธิ์จาก JWT Token */}
        <div className="header">
          <div>
            <h2 className="header-title">ระบบบริหารจัดการผู้ใช้ (User Management)</h2>
            <small className="user-info">
              ผู้ใช้งานปัจจุบัน: <b>{user.username}</b> |
              ระดับสิทธิ์: <b className={isAdmin ? 'role-admin' : (canEdit ? 'role-editonly' : 'role-readonly')}>{user.role}</b>
            </small>
          </div>
          <button onClick={handleLogout} className="btn-danger">
            ออกจากระบบ (Logout)
          </button>
        </div>

        {/* UI กล่องแจ้งเตือนสถานะการทำงาน (Error / Success) */}
        {msg.text && (
          <div className={msg.isError ? "alert-error" : "alert-success"}>
            {msg.text}
          </div>
        )}

        {/* ------------------------------------------------------------------------ */}
        {/* ฟอร์มเพิ่มข้อมูลพร้อมแนบไฟล์ (แสดงเฉพาะ Admin ตามระดับสิทธิ์)             */}
        {/* ------------------------------------------------------------------------ */}
        {isAdmin && (
          <div className="admin-create-box">
            <h4 className="admin-create-title">เพิ่มผู้ใช้ใหม่พร้อมแนบไฟล์ข้อมูล</h4>
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
              <div>
                <input
                  type="file"
                  ref={newFileInputRef}
                  onChange={e => setNewFile(e.target.files[0])}
                />
              </div>
              <button type="submit" className="btn-success">
                บันทึกข้อมูล
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------------------ */}
        {/* ระบบค้นหาและกรองข้อมูล (Search & Filter ตามสิทธิ์ผู้ใช้งาน)               */}
        {/* ------------------------------------------------------------------------ */}
        <div className="filter-bar">
          {/* ทุกสิทธิ์สามารถค้นหาตามชื่อได้ */}
          <input
            placeholder="ค้นหาชื่อผู้ใช้ (Search)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* เฉพาะ Admin ที่สามารถกรองตามระดับสิทธิ์ (Role Filter) ได้ */}
          {isAdmin && (
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="">ทุกระดับบทบาท (All Roles)</option>
              <option value="admin">admin</option>
              <option value="editonly">editonly</option>
              <option value="readonly">readonly</option>
            </select>
          )}

          {/* Admin และ Editonly ที่สามารถกรองสถานะออนไลน์ได้ */}
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

        {/* ------------------------------------------------------------------------ */}
        {/* แสดงรายการข้อมูลตามระดับสิทธิ์ของผู้ใช้งานในรูปแบบตาราง                     */}
        {/* ------------------------------------------------------------------------ */}
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

                    {/* การจัดการปุ่มแก้ไข/ลบ ตามระดับสิทธิ์ */}
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
