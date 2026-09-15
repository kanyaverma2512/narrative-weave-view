import { createServerFn } from "@tanstack/react-start";
import { collectLiveWeb, type LiveWebResult } from "./live-web.server";

export const getLiveWeb = createServerFn({ method: "GET" })
  .inputValidator((data: { query?: string } | undefined) => ({
    query: (data?.query ?? "").trim() || "Cockroach Janta Party",
  }))
  .handler(async ({ data }): Promise<LiveWebResult> => collectLiveWeb(data.query));
