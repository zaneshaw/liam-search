import ytdlpWrap from "yt-dlp-wrap";
import readline from "readline";

interface VideoInfo {
	id?: string;
	title?: string;
	thumbnailUrl?: string;
	channnelTitle?: string;
	channnelId?: string;
}

const ytdlp = new ytdlpWrap("./bin/yt-dlp.exe");
const playlistUrl = "PLeMf46ndvGffIJt5KKDa_5SbXZ6F3azhP";
const cookiesPath = "cookies.txt";

async function loadVideoMetadata(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0] as string;

	let videos: { fetch_date: string; videos: any[] } = {
		fetch_date: currentDate,
		videos: [],
	};

	if (await file.exists()) {
		const _videos = await file.json();

		if (_videos.fetch_date == currentDate) {
			console.log("already loaded video metadata today. loading from cache...");

			return _videos;
		}

		videos = _videos;
	}

	console.log("loading video metadata...");

	const playlistRaw = await ytdlp.execPromise([
		"--flat-playlist",
		"--print",
		"%(id)s\t%(title)s\t%(uploader)s",
		"--cookies",
		cookiesPath,
		"--extractor-args",
		"youtubetab:skip=authcheck",
		playlistUrl,
	]);

	for (const video of playlistRaw.trim().split("\n")) {
		const videoArr = video.split("\t");
		const videoIndex = videos.videos.findIndex((x) => x.id == videoArr[0]);
		const videoObj = {
			id: videoArr[0],
			title: videoArr[1],
			thumbnail: `https://i.ytimg.com/vi/${videoArr[0]}/mqdefault.jpg`,
			uploader: videoArr[2],
		};

		if (videoIndex > -1) {
			Object.assign(videos.videos[videoIndex], videoObj);
		} else {
			videos.videos.push(videoObj);
		}
	}

	console.log(`writing to ${file.name}...`);
	await file.write(JSON.stringify(videos, null, "\t"));

	return videos;
}

async function downloadSubtitles(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0] as string;

	const videos = await loadVideoMetadata(file);

	if (await file.exists()) {
		const _videos = await file.json();

		if (_videos.fetch_date == currentDate) {
			console.log("already downloaded subtitles today. skipping...");

			return;
		}
	}

	for (let i = 0; i < videos.videos.length; i++) {
		const video = videos.videos[i];

		readline.cursorTo(process.stdout, 0);
		process.stdout.write(`downloading subtitles ${i + 1} of ${videos.videos.length}...`);

		if (!video.subtitles_path) {
			const stdout = await ytdlp.execPromise([
				"--skip-download",
				"--write-sub",
				"--write-auto-sub",
				"--sub-lang",
				"en",
				"--sub-format",
				"srt",
				"--cookies",
				cookiesPath,
				"-o",
				"subtitles/%(id)s.%(ext)s",
				`https://www.youtube.com/watch?v=${video.id}`,
			]);

			if (stdout.includes("There are no subtitles for the requested languages")) {
				continue;
			}

			const destinationStdout = "[download] Destination: ";
			const destination = stdout
				.split("\n")
				.find((line) => line.startsWith(destinationStdout))
				?.slice(destinationStdout.length);

			video.subtitles_path = destination;

			await file.write(JSON.stringify(videos, null, "\t"));
		}
	}

	process.stdout.write("\n");
}

		console.log("no videos have missing subtitles");
}

await downloadSubtitles(Bun.file("videos.json"));
const missingSubtitlesIds = await checkMissingSubtitles(Bun.file("videos.json"));

console.log(missingSubtitlesIds);
