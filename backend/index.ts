import FlexSearch, { Document } from "flexsearch";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { getConnInfo } from "hono/cloudflare-workers";
import { logBuffer } from "./log";

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
		console.log("ready!");
		logBuffer.push({
			time: Date.now(),
			text: "(SYSTEM) ready!",
		});
	} else if (type == "INDEXING_ERROR") {
		status = "indexing_error";
	}
});

const app = new Hono();
app.use(cors());

app.get("/status", (c) => {
	const info = getConnInfo(c);

	// logBuffer.push({
	// 	time: Date.now(),
	// 	text: `(REMOTE_IP=${info.remote.address || "UNKNOWN"},ENDPOINT=/status,STATUS=400) status is "${status}".`,
	// });

	return c.json({ status: status });
});

// needs validation and sanitisation
app.get("/search", async (c) => {
	const info = getConnInfo(c);

	if (status != "ready") {
		c.status(503);

		logBuffer.push({
			time: Date.now(),
			text: `(REMOTE_IP=${info.remote.address || "UNKNOWN"},ENDPOINT=/search,STATUS=503) api is not ready.`,
		});

		return c.json({ message: "api is not ready" });
	}

	const { query, maxResults } = c.req.query();

	if (query) {
		const res: any = await workerFunction(
			searchWorker,
			{
				type: "SEARCH",
				query: encodeURI(query),
				maxResults: maxResults ? parseInt(maxResults as string) : undefined,
			},
			"SEARCH_RESULT"
		);

		logBuffer.push({
			time: Date.now(),
			text: `(REMOTE_IP=${info.remote.address || "UNKNOWN"},ENDPOINT=/search,STATUS=200) ${res.message} ${res.results.length} results for "${encodeURI(query)}".`,
		});

		return c.json(res);
	} else {
		c.status(400);

		logBuffer.push({
			time: Date.now(),
			text: `(REMOTE_IP=${info.remote.address || "UNKNOWN"},ENDPOINT=/search,STATUS=400) empty query.`,
		});

		return c.json({});
	}
});

serve({
	fetch: app.fetch,
	port: 8059,
});

searchWorker.postMessage({ type: "SETUP" });
