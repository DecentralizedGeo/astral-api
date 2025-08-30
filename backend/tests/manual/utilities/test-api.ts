import axios from 'axios';

async function testAPI() {
  try {
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('Health endpoint response:', healthResponse.data);
    
    // Test API config endpoint
    const configResponse = await axios.get('http://localhost:3000/api/v0/config');
    console.log('Config endpoint response:', configResponse.data);
    
    // Test root endpoint
    const rootResponse = await axios.get('http://localhost:3000/');
    console.log('Root endpoint response:', rootResponse.data);
    
    // Test sync status endpoint
    const syncResponse = await axios.get('http://localhost:3000/api/sync/status');
    console.log('Sync status endpoint response:', syncResponse.data);
  } catch (error: any) {
    console.error('Error testing API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();