import { Index, MeiliSearch, type RecordAny } from "meilisearch";
import { downloadSubtitles, checkMissingSubtitles, convertSubtitles } from "./subtitleScraper";
import { log, LogType } from "./log";

declare var self: Worker;

const msClient = new MeiliSearch({
	host: "http://192.168.0.88:7700",
});
let index: Index<RecordAny> | null = null;
let videos: any;

async function setup() {
	await downloadSubtitles(Bun.file("videos.json"));
	const missingSubtitlesIds = await checkMissingSubtitles(Bun.file("videos.json"));

	log(LogType.System, "converting subtitles...");
	const subtitles = await convertSubtitles();

	log(LogType.System, `caching ${subtitles.length} converted subtitles...`);
	await Bun.file("subtitles_converted_flat.json").write(JSON.stringify(subtitles));

	const index = await msClient.getIndex("subtitles");
	if (index.updatedAt && index.updatedAt.toLocaleDateString() != new Date().toLocaleDateString()) {
		log(LogType.System, "building index...");

		await msClient.deleteIndexIfExists("subtitles");

		index.updateTypoTolerance({
			minWordSizeForTypos: {
				oneTypo: 8,
				twoTypos: 12,
			},
		});

		const task = await msClient.index("subtitles").addDocuments(subtitles, { primaryKey: "id" });

		await msClient.tasks.waitForTask(task.taskUid, { timeout: 0 });
	} else {
		log(LogType.System, "index already built today. skipping...");
	}

	return index;
}

async function search(query: string, page: number = 1) {
	if (!index) return;

	const res = await index.search(query, {
		limit: 1000,
		matchingStrategy: "frequency",
		showRankingScore: true,
		rankingScoreThreshold: 0.85,
		hitsPerPage: 30,
		page: page,
	});

	const results = await Promise.all(
		res.hits.map(async (result) => {
			const metadata = videos.videos.find((video: any) => video.id == result.video_id);

			const textBeforeDoc = await index!.getDocument((result.id as number) - 1);
			let textBefore = null;
			if (textBeforeDoc && textBeforeDoc.video_id == result.video_id) {
				textBefore = textBeforeDoc.text;
			}
			const textAfterDoc = await index!.getDocument((result.id as number) + 1);
			let textAfter = null;
			if (textAfterDoc && textAfterDoc.video_id == result.video_id) {
				textAfter = textAfterDoc.text;
			}

			return {
				...result,
				text_before: textBefore,
				text_after: textAfter,
				title: metadata.title,
				thumbnail: metadata.thumbnail,
				uploader: metadata.uploader,
			};
		})
	);

	postMessage({
		type: "SEARCH_RESULT",
		res: {
			message: "search successful!",
			processingTime: res.processingTimeMs,
			totalResults: res.totalHits,
			totalPages: res.totalPages,
			resultsPerPage: res.hitsPerPage,
			page: res.page,
			results: results,
		},
	});
}

self.addEventListener("message", async (e) => {
	if (e.data.type == "SETUP") {
		try {
			index = await setup();
			videos = await Bun.file("videos.json").json();

			postMessage({ type: "READY" });
		} catch (err) {
			console.error("indexing failed", err);
			postMessage({ type: "INDEXING_ERROR" });
		}
	} else if (e.data.type == "SEARCH") {
		search(e.data.query, e.data.page);
	}
});
