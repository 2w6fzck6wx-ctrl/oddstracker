export async function GET() {
  return new Response(JSON.stringify({ status: "running", timestamp: new Date().toISOString() }), { headers: { "Content-Type": "application/json" } });
}
