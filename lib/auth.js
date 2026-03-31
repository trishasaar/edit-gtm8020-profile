async function validateMemberstackToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const res = await fetch("https://admin.memberstack.com/members/current", {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-API-Key": process.env.MEMBERSTACK_SECRET_KEY,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://www.gtm8020.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

module.exports = { validateMemberstackToken, getCorsHeaders };
