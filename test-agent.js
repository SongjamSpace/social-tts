async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/agent/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "hello there", username: "testUser" })
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Text:", data.text);
    console.log("Audio length:", data.audio ? data.audio.length : "No audio");
    if (data.error) {
       console.log("Error:", data.error);
    }
  } catch (err) {
    console.error("Fetch error", err);
  }
}
test();
