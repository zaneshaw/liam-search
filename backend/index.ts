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

async function loadVideoMetadata(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0] as string;

	if (await file.exists()) {
		const videos = await file.json();

		if (videos.fetch_date == currentDate) {
			console.log("already loaded video metadata today. loading from cache...");

			return videos;
		}
	}

	console.log("loading video metadata...");

	const playlistRaw = await ytdlp.execPromise(["--flat-playlist", "--print", "%(id)s\t%(title)s\t%(uploader)s", playlistUrl]);

	const videos: { fetch_date: string; videos: any[] } = {
		fetch_date: currentDate,
		videos: [],
	};

	for (const video of playlistRaw.trim().split("\n")) {
		const videoArr = video.split("\t");
		videos.videos.push({
			id: videoArr[0],
			title: videoArr[1],
			thumbnail: `https://i.ytimg.com/vi/${videoArr[0]}/mqdefault.jpg`,
			uploader: videoArr[2],
			subtitles_path: null,
		});
	}

	console.log(`writing to ${file.name}...`);
	await file.write(JSON.stringify(videos, null, "\t"));

	return videos;
}

async function downloadSubtitles(file: Bun.BunFile) {
	const videos = await loadVideoMetadata(file);

	for (let i = 0; i < videos.videos.length; i++) {
		const video = videos.videos[i];

		readline.cursorTo(process.stdout, 0);
		process.stdout.write(`downloading transcript ${i + 1} of ${videos.videos.length}...`);

		if (!video.subtitles_path) {
			const stdout = await ytdlp.execPromise([
				"--skip-download",
				"--write-sub",
				"--write-auto-sub",
				"--sub-lang",
				"en",
				"--sub-format",
				"srt",
				"-o",
				"subtitles/%(id)s.%(ext)s",
				`https://www.youtube.com/watch?v=${video.id}`,
			]);

			if (stdout.includes("There are no subtitles for the requested languages")) {
				continue;
			}

			const destinationStdout = "[download] Destination: ";
			const destination = stdout.split("\n").find(line => line.startsWith(destinationStdout))?.slice(destinationStdout.length);

			video.subtitles_path = destination;

			await file.write(JSON.stringify(videos, null, "\t"));
		}
	}

	process.stdout.write("\n");
}

await downloadSubtitles(Bun.file("videos.json"));
