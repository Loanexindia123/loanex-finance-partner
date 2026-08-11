require('dotenv').config();

const API_ID = process.env.IDSPAY_API_ID;
const API_KEY = process.env.IDSPAY_API_KEY;
const TOKEN_ID = process.env.IDSPAY_TOKEN_ID;
const PROD_URL = 'https://javabackend.idspay.in/api/v1/prod/pan/verification';

async function testPanVerification(pan) {
  console.log(`\n=================================================`);
  console.log(`Testing with PAN: ${pan}`);
  
  const payload = {
    api_id: API_ID,
    api_key: API_KEY,
    token_id: TOKEN_ID,
    pan_number: pan,
    full_name: 'MOHD MUSHARRAF GOURI',
    dob: '05/07/2003'
  };

  try {
    const res = await fetch(PROD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    console.log(`Status: ${res.status}`);
    console.log(JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.log(`Fetch error:`, err.message);
  }
}

testPanVerification('EGHPG9093N');
