import { google } from "googleapis";

interface Video {
	id?: string;
	title?: string;
	thumbnailUrl?: string;
	channnelTitle?: string;
	channnelId?: string;
	captionsUrl?: any;
}

const playlistUrl = "PLeMf46ndvGffIJt5KKDa_5SbXZ6F3azhP";

const youtube = google.youtube({
	version: "v3",
	auth: Bun.env.API_KEY,
});

async function getPlaylistVideos(videos: Video[] = [], nextPageToken: string | undefined = undefined): Promise<Video[]> {
	const res = await youtube.playlistItems.list({
		part: ["snippet"],
		playlistId: playlistUrl,
		maxResults: 50,
		pageToken: nextPageToken,
	});

	if (res.data.items && res.data.items.length > 0) {
		for (const item of res.data.items) {
			const snippet = item.snippet;
			const video: Video = {
				id: snippet?.resourceId?.videoId ?? undefined,
				title: snippet?.title ?? undefined,
				thumbnailUrl: snippet?.thumbnails?.medium?.url ?? undefined,
				channnelTitle: snippet?.videoOwnerChannelTitle ?? undefined,
				channnelId: snippet?.videoOwnerChannelId ?? undefined,
			};

			videos.push(video);
		}

		if (res.data.nextPageToken) {
			await getPlaylistVideos(videos, res.data.nextPageToken);
		}
	}

	return videos;
}

const videos = await getPlaylistVideos();

await Bun.file("videos.json").write(JSON.stringify(videos, null, "\t"));
