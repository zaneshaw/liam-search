import FlexSearch, { Document } from "flexsearch";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { getConnInfo } from "hono/cloudflare-workers";
import { log, LogType } from "./log";

// sucks
let status: "loading" | "ready" | "indexing_error" = "loading";

const searchWorker = new Worker("./search.ts");

async function workerFunction(worker: Worker, message: any, resultType: string) {
	return new Promise((resolve, reject) => {
		const listener = (e: any) => {
			if (e.data.type === resultType) {
				worker.removeEventListener("message", listener);

				resolve(e.data.res);
			}
		};

		worker.addEventListener("message", listener);

		worker.postMessage(message);
	});
}

searchWorker.addEventListener("message", async (e) => {
	const { type } = e.data;

	if (type == "READY") {
		status = "ready";
		log(LogType.System, "ready!");
	} else if (type == "INDEXING_ERROR") {
		status = "indexing_error";
	}
});

const app = new Hono();
app.use("/*", cors());

app.get("/status", (c) => {
	const info = getConnInfo(c);

	// log(LogType.API, `status is '${status}'`, { remote_ip: info.remote.address || "UNKNOWN", endpoint: "/status", status: "200" });

	return c.json({ status: status });
});

// needs validation and sanitisation
app.get("/search", async (c) => {
	const info = getConnInfo(c);

	if (status != "ready") {
		c.status(503);

		log(LogType.API, "api is not ready.", { remote_ip: info.remote.address || "UNKNOWN", endpoint: "/search", status: "503" });

		return c.json({ message: "api is not ready" });
	}

	const { query, max_results } = c.req.query();

	if (query) {
		const res: any = await workerFunction(
			searchWorker,
			{
				type: "SEARCH",
				query: query,
				maxResults: max_results ? parseInt(max_results as string) : undefined,
			},
			"SEARCH_RESULT"
		);

		log(LogType.API, `${res.message} ${res.results.length} results for '${query}'.`, { remote_ip: info.remote.address || "UNKNOWN", endpoint: "/search", status: "200" });

		return c.json(res);
	} else {
		c.status(400);

		log(LogType.API, "empty query.", { remote_ip: info.remote.address || "UNKNOWN", endpoint: "/search", status: "400" });

		return c.json({});
	}
});

serve({
	fetch: app.fetch,
	port: 8059,
});

searchWorker.postMessage({ type: "SETUP" });
