import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CLIENT_KIND_HEADER } from "@promptizer/shared";
import { classifyDevice, isMobileSplitRoute } from "@/lib/device";
import type { DeviceClass } from "@/lib/device";

const ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = `Authorization, Content-Type, ${CLIENT_KIND_HEADER}`;
const MOBILE_PREFIX = "/m";

function resolveDeviceClass(request: NextRequest): DeviceClass {
  const clientHint = request.headers.get("sec-ch-ua-mobile");
  if (clientHint === "?1") {
    return "mobile";
  }
  if (clientHint === "?0") {
    return "desktop";
  }
  return classifyDevice(request.headers.get("user-agent"));
}

function withCorsHeaders(response: NextResponse, allowedOrigin: string): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", "600");
  return response;
}

function apiResponse(request: NextRequest): NextResponse {
  const allowedOrigin = process.env.EXTENSION_ORIGIN;
  const isExtensionCaller = Boolean(allowedOrigin) && request.headers.get("origin") === allowedOrigin;
  const response = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  if (isExtensionCaller && allowedOrigin) {
    withCorsHeaders(response, allowedOrigin);
  }
  response.headers.append("Vary", "Origin");
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return apiResponse(request);
  }

  if (resolveDeviceClass(request) === "mobile" && isMobileSplitRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `${MOBILE_PREFIX}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|m/|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)"],
};
