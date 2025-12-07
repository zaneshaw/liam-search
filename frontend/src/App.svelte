<script lang="ts">
	let data: any = $state(null);
	let searchQueryInput: HTMLInputElement;

	$inspect(data);

	async function doSearch(query: string, maxResults?: number) {
		const res = await fetch(`http://localhost:3000/search?query=${query}&max_results=${maxResults}`);
		data = await res.json();
	}
</script>

<main>
	<input type="text" bind:this={searchQueryInput} />
	<button onclick={() => doSearch(searchQueryInput.value)}>search</button>
	<button onclick={() => (data = null)}>clear search</button>
	{#if data}
		{#each data.results as video}
			<div>
				<img src={video.thumbnail} alt="" />
				<p>
					<a href="https://www.youtube.com/watch?v={video.video_id}&t={new Date(`1970-01-01T${video.time_start.split(',')[0]}.000Z`).getTime() / 1000}" target="_blank">
						"{video.text}" found in "{video.title}" at {video.time_start.split(",")[0]}
					</a>
				</p>
				<pre>{JSON.stringify(video, null, "\t")}</pre>
			</div>
		{/each}
	{:else}
		<p>...</p>
	{/if}
</main>
