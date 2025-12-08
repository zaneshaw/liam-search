import FlexSearch, { Document } from "flexsearch";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { downloadSubtitles, checkMissingSubtitles, convertSubtitles } from "./subtitleScraper";
import { serve } from "@hono/node-server";

// sucks
let index: Document;
let videos: any;
let status: "loading" | "ready" = "loading";

function search(query: string, videos: any, index: Document, maxResults: number = 9) {
	const fsResults = new FlexSearch.Resolver({
		index: index,
		query: query,
		pluck: "text",
	})
		.resolve({
			enrich: true,
		})
		.slice(0, maxResults);

	const results = fsResults.map((result) => {
		if (!result.doc) return;

		const metadata = videos.videos.find((video: any) => video.id == result.doc!.video_id);

		const textBeforeDoc = index.get((result.doc!.id as number) - 1);
		let textBefore = null;
		if (textBeforeDoc && textBeforeDoc.video_id == result.doc!.video_id) {
			textBefore = textBeforeDoc.text;
		}

		const textAfterDoc = index.get((result.doc!.id as number) + 1);
		let textAfter = null;
		if (textAfterDoc && textAfterDoc.video_id == result.doc!.video_id) {
			textAfter = textAfterDoc.text;
		}

		return {
			score: result.doc!.score,
			text: result.doc!.text,
			text_before: textBefore,
			text_after: textAfter,
			video_id: result.doc!.video_id,
			time_start: result.doc!.time_start,
			time_end: result.doc!.time_end,
			title: metadata.title,
			thumbnail: metadata.thumbnail,
			uploader: metadata.uploader,
		};
	});

	return {
		message: "search successful!",
		results: results,
	};
}

const app = new Hono();
app.use(cors());

app.get("/status", (c) => c.json({ status: status }));

// needs validation and sanitisation
app.get("/search", (c) => {
	if (status != "ready") {
		c.status(503);
		return c.json({ message: "api is not ready" });
	}

	const { query, maxResults } = c.req.query();

	if (query) {
		const res = search(query, videos, index, maxResults ? parseInt(maxResults as string) : undefined);
		return c.json(res);
	} else {
		c.status(400);
		return c.json({});
	}
});

async function setup() {
	await downloadSubtitles(Bun.file("videos.json"));
	const missingSubtitlesIds = await checkMissingSubtitles(Bun.file("videos.json"));

	console.log("converting subtitles...");
	const convertedSubtitles = await convertSubtitles();

	console.log(`caching ${convertedSubtitles.length} converted subtitles...`);
	await Bun.file("subtitles_converted_flat.json").write(JSON.stringify(convertedSubtitles));

	console.log("building index...");

	const index = new FlexSearch.Document({
		tokenize: "forward",
		context: {
			resolution: 9,
			depth: 2,
			bidirectional: true,
		},
		encoder: FlexSearch.Charset.Normalize,
		document: {
			store: true,
			index: "text",
		},
	});

	for (const subtitle of convertedSubtitles) {
		index.add(subtitle);
	}

	console.log("ready!");

	return index;
}

serve({
	fetch: app.fetch,
	port: 8059,
});

index = await setup();
videos = await Bun.file("videos.json").json();
status = "ready";
