export async function GET() {
  const ping = process.env.PING_MESSAGE ?? "ping";
  return Response.json({ message: ping });
}
