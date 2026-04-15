const fetch = require('node-fetch');

const API_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'rammodhvadiya210@gmail.com';
const USER_EMAIL = 'testuser@vaultskins.com';
const PASSWORD = 'password123';

async function test() {
  console.log('--- Testing Unified Login System ---');

  // 1. Test Admin Login (Auto-registers if not exists)
  console.log(`\n1. Testing Admin Login (${ADMIN_EMAIL}):`);
  try {
    const adminRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD })
    }).then(r => r.json());
    
    console.log('Admin Login Response:', adminRes);
    if (adminRes.role === 'admin') {
      console.log('✅ Admin role correctly assigned.');
    } else {
      console.log('❌ Admin role FAILED.');
    }

    const adminToken = adminRes.token;

    // 2. Test Admin Dashboard Access
    console.log('\n2. Testing Admin Dashboard Access (with admin token):');
    const adminDashRes = await fetch(`${API_URL}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    console.log('Admin Dashboard Response status:', adminDashRes.error ? 'FAILED' : 'SUCCESS');

  } catch (e) {
    console.log('Error testing admin login:', e.message);
  }

  // 3. Test Normal User Login
  console.log(`\n3. Testing Normal User Login (${USER_EMAIL}):`);
  try {
    const userRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USER_EMAIL, password: PASSWORD })
    }).then(r => r.json());
    
    console.log('User Login Response:', userRes);
    if (userRes.role === 'user') {
      console.log('✅ User role correctly assigned.');
    } else {
      console.log('❌ User role FAILED.');
    }

    const userToken = userRes.token;

    // 4. Test Admin Dashboard Access (with user token)
    console.log('\n4. Testing Admin Dashboard Access (with user token):');
    const userDashRes = await fetch(`${API_URL}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    console.log('User accessing admin dash status:', userDashRes.status);
    if (userDashRes.status === 403) {
      console.log('✅ Access correctly denied (403 Forbidden).');
    } else {
      console.log('❌ Access denial FAILED.');
    }

  } catch (e) {
    console.log('Error testing user login:', e.message);
  }

  console.log('\n--- Testing Complete ---');
}

test();
