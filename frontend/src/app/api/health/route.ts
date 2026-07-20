export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "frontend",
    },
    { status: 200 }
  );
}