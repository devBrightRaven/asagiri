import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Only apply CORS to sasagani API routes
  if (!request.nextUrl.pathname.startsWith("/api/sasagani")) {
    return NextResponse.next();
  }

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Add CORS headers to response
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export const config = {
  matcher: "/api/sasagani/:path*",
};
