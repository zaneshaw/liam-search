import FlexSearch, { Document } from "flexsearch";
import { downloadSubtitles, checkMissingSubtitles, convertSubtitles } from "./subtitleScraper";
import { logBuffer } from "./log";

declare var self: Worker;

const index = new FlexSearch.Document({
	tokenize: "full",
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
let videos: any;

async function setup() {
	await downloadSubtitles(Bun.file("videos.json"));
	const missingSubtitlesIds = await checkMissingSubtitles(Bun.file("videos.json"));

	console.log("converting subtitles...");
	logBuffer.push({
		time: Date.now(),
		text: `(SYSTEM) converting subtitles...`,
	});
	const convertedSubtitles = await convertSubtitles();

	console.log(`caching ${convertedSubtitles.length} converted subtitles...`);
	logBuffer.push({
		time: Date.now(),
		text: `(SYSTEM) caching ${convertedSubtitles.length} converted subtitles...`,
	});
	await Bun.file("subtitles_converted_flat.json").write(JSON.stringify(convertedSubtitles));

	console.log("building index...");
	logBuffer.push({
		time: Date.now(),
		text: "(SYSTEM) building index...",
	});

	for (const subtitle of convertedSubtitles) {
		index.add(subtitle);
	}

	return index;
}

function search(query: string, maxResults: number = 9) {
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

	postMessage({
		type: "SEARCH_RESULT",
		res: {
			message: "search successful!",
			results: results,
		},
	});
}

self.addEventListener("message", async (e) => {
	if (e.data.type == "SETUP") {
		try {
			await setup();
			videos = await Bun.file("videos.json").json();

			postMessage({ type: "READY" });
		} catch (err) {
			console.error("indexing failed", err);
			postMessage({ type: "INDEXING_ERROR" });
		}
	} else if (e.data.type == "SEARCH") {
		search(e.data.query, e.data.maxResults);
	}
});
