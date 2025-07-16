const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testSendOTP() {
  try {
    console.log('🧪 Testing Send OTP...');
    const response = await axios.post(`${API_BASE}/auth/send-otp`, {
      email: 'test@example.com',
      name: 'Test User'
    });
    console.log('✅ Send OTP Response:', response.data);
  } catch (error) {
    console.log('❌ Send OTP Error:', error.response?.data || error.message);
  }
}

async function testGoogleAuth() {
  try {
    console.log('🧪 Testing Google Auth...');
    const response = await axios.post(`${API_BASE}/auth/google`, {
      googleId: 'test123',
      email: 'test@gmail.com',
      name: 'Test User',
      profileImage: 'https://example.com/image.jpg'
    });
    console.log('✅ Google Auth Response:', response.data);
  } catch (error) {
    console.log('❌ Google Auth Error:', error.response?.data || error.message);
  }
}

async function testBasicAPI() {
  try {
    console.log('🧪 Testing Basic API...');
    const response = await axios.get(`${API_BASE}/../`);
    console.log('✅ Basic API Response:', response.data);
  } catch (error) {
    console.log('❌ Basic API Error:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  await testBasicAPI();
  console.log('');
  
  await testSendOTP();
  console.log('');
  
  await testGoogleAuth();
  console.log('');
  
  console.log('✨ Tests completed!');
}

runTests();
