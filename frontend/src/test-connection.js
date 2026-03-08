console.log('🔍 HarmonyHub Diagnostic Tool\n');

// Check environment
console.log('Environment Variables:');
console.log(`- Frontend URL: ${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}`);
console.log(`- Socket URL: ${import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'}`);
console.log('');

// Test API connection
async function testAPI() {
  console.log('Testing API Connection...');
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      console.log('✅ Backend API is responding');
    } else {
      console.log('❌ Backend returned error:', response.status);
    }
  } catch (error) {
    console.log('❌ Cannot connect to backend:', error.message);
    console.log('   Make sure backend is running on port 3000');
  }
}

// Test Socket connection
import { socket } from './socket/socket.js';

socket.on('connect', () => {
  console.log('✅ Socket.io connected');
  
  // Test room join
  socket.emit('join_room', 'TEST123');
  
  socket.on('leaderboard_update', (data) => {
    console.log('✅ Received leaderboard update:', data);
  });
  
  socket.on('error', (error) => {
    console.log('❌ Socket error:', error);
  });
});

socket.on('connect_error', (error) => {
  console.log('❌ Socket connection error:', error.message);
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
});

testAPI();

console.log('');
console.log('📝 Open browser console (F12) to see socket events');
console.log('📝 Check if backend shows "User connected" messages');
