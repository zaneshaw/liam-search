<script lang="ts">
	import { Search } from "lucide-svelte";
	import { onMount } from "svelte";

	let data: any = $state(null);
	let searchQueryInput: HTMLInputElement;
	let helpModal: HTMLDialogElement;

	$inspect(data);

	async function doSearch(query: string, maxResults?: number) {
		const res = await fetch(`https://api.liamsear.ch/search?query=${query}&max_results=${maxResults || ""}`);
		data = await res.json();
	}
</script>

<main class="mx-auto flex h-screen w-[512px] flex-col gap-5 pt-10">
	<div class="flex flex-col items-center">
		<div class="flex items-center justify-center gap-5">
			<img src="logo.png" alt="Liam logo" class="h-16" />
			<h1>Liam Search</h1>
		</div>
		<p class="text-gray-500">made by <a href="https://squidee.dev/" target="_blank" class="link">squidee_</a> from chat</p>
	</div>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			doSearch(searchQueryInput.value);
		}}
		class="light-outline flex overflow-clip rounded-full outline-1 has-[input:focus]:outline-blue-500!"
	>
		<!-- svelte-ignore a11y_autofocus -->
		<input type="text" bind:this={searchQueryInput} autofocus class="bg-background! grow px-5 py-1" />
		<button class="btn rounded-none! px-4!"><Search class="w-5" /></button>
	</form>
	{#if data}
		{#if data.results}
			<p class="text-gray-500 italic">found {data.results.length} results</p>
			<div class="mx-auto flex flex-col gap-10">
				{#each data.results as video}
					<div class="flex flex-col">
						<iframe
							width="512"
							height="288"
							src="https://www.youtube-nocookie.com/embed/{video.video_id}?start={new Date(`1970-01-01T${video.time_start.split(',')[0]}.000Z`).getTime() / 1000}"
							title=""
							frameborder="0"
							allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowfullscreen
							class="bg-black"
						></iframe>
						<p>
							<a href="https://www.youtube.com/watch?v={video.video_id}" target="_blank" class="font-bold">
								{video.title}
							</a>
							<span class="text-gray-500">at</span>
							<a
								href="https://www.youtube.com/watch?v={video.video_id}&t={new Date(`1970-01-01T${video.time_start.split(',')[0]}.000Z`).getTime() / 1000}"
								target="_blank"
								class="text-blue-500 hover:text-blue-400"
							>
								{video.time_start.split(",")[0]}
							</a>
						</p>
						<p class="text-gray-500 italic">"...{video.text_before} <span class="font-medium text-white">{video.text}</span> {video.text_after}..."</p>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-center text-gray-500 italic">no results</p>
		{/if}
	{/if}
	<div class="mt-auto flex justify-center gap-2 pb-10 text-gray-500">
		<button onclick={() => helpModal.showModal()} class="link">help / more info</button>
		<span>•</span>
		<a href="https://github.com/zaneshaw/liam-search" target="_blank" class="link">source code<sup>🡥</sup></a>
		<span>•</span>
		<a href="https://www.twitch.tv/liam" target="_blank" class="link">liam twitch<sup>🡥</sup></a>
	</div>
</main>
<dialog bind:this={helpModal} class="inset-0 size-full max-h-none max-w-none bg-transparent">
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		onclick={(e) => {
			if (e.target === helpModal.firstChild) helpModal.close();
		}}
		class="flex h-full w-full items-center justify-center bg-black/50"
	>
		<div class="bg-liam-background text-liam-skin flex h-1/2 w-1/3 overflow-hidden rounded-lg">
			<div class="flex flex-col gap-8 overflow-y-auto px-6 py-8">
				<div class="flex flex-col gap-2">
					<h2>about</h2>
					<p>
						this website lets you search for phrases spoken on Liam's stream, using transcripts from VODs uploaded to youtube from August 2023 onwards. the name "Liam Search" and domain
						name "liamsear.ch" are directly inspired by <a href="https://yardsear.ch/" target="_blank" class="link">yardsear.ch</a>, but this website was mainly
						<a href="https://www.youtube.com/@CtrlaltdeliciousHD" target="_blank" class="link">CtrlAltDelicious'</a> idea.
					</p>
				</div>
				<div class="flex flex-col gap-2">
					<h2>faq <span class="text-liam-skin font-light">(no one asked these)</span></h2>
					<div>
						<p class="text-white italic">why can't i search swear words?</p>
						<p>
							the index is built from youtube subtitles, which replace pretty much every swear word with "[ __ ]". i'm planning to transcribe the vods myself at some point so i don't
							have to depend on youtube's transcription.
						</p>
					</div>
					<div>
						<p class="text-white italic">which vods are indexed?</p>
						<p>
							every vod in <a href="https://www.youtube.com/playlist?list=PLeMf46ndvGffIJt5KKDa_5SbXZ6F3azhP" target="_blank" class="link">this playlist</a> by
							<a href="https://www.youtube.com/@LiamUnofficialVODs-dz8it" target="_blank" class="link">Liam Unofficial VODs</a> minus about 30 videos that have unpublished subtitles.
						</p>
					</div>
					<div>
						<p class="text-white italic">why are results limited to 9?</p>
						<p>
							loading a lot of youtube embeds is really laggy for some reason and has crashed my browser multiple times during development. to mitigate this, i've temporarily limited the
							amount of results. you can bypass this limit for now by using this URL:
						</p>
						<a href="https://api.liamsear.ch/search?query=hello world&max_results=20" target="_blank" class="text-sm link"
							>https://api.liamsear.ch/search?query=hello world&max_results=20</a
						>
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<h2>indexing process</h2>
					<ol class="ml-4.5 list-decimal">
						<li>
							video metadata is fetched from <a href="https://www.youtube.com/playlist?list=PLeMf46ndvGffIJt5KKDa_5SbXZ6F3azhP" target="_blank" class="link">this playlist</a> with yt-dlp
						</li>
						<li>srt subtitles are downloaded from these videos with yt-dlp</li>
						<li>
							the srt files are merged together to form a large json file (~150 MB) containing the text, start time, and video id of each subtitle chunk (a chunk is the highlighted text
							when you search something).
						</li>
						<li>
							<a href="https://github.com/nextapps-de/flexsearch" target="_blank" class="link">FlexSearch</a> then indexes each subtitle chunk and stores the index in memory with the following
							configuration:
						</li>
						<pre>
&#123;
	tokenize: "forward",
	context: &#123; resolution: 9, depth: 2, bidirectional: true &#125;,
	encoder: FlexSearch.Charset.Normalize,
	document: &#123; store: true, index: "text" &#125;,
&#125;</pre>
						<li>this process is repeated every day at 12:00 AM AEST</li>
					</ol>
					<p>
						note: indexing does not account for repeated tokens/words as FlexSearch's "Normalize" encoder preset combines these into a single word (e.g. "night night liam" is equivalent to
						"night liam"). at some point i'll let you pick between the current index and a new "strict" index.
					</p>
				</div>
			</div>
		</div>
	</div>
</dialog>
