<script lang="ts">
	let { status }: { status: string } = $props();

	// probably a nicer way to do this
	let colors: { [index: string]: any } = {
		loading: ["bg-yellow-950", "text-yellow-400"],
		indexing_error: ["bg-red-950", "text-red-400"],
		api_error: ["bg-red-950", "text-red-400"]
	};
</script>

{#if colors[status]}
	<div class="w-full rounded-lg {colors[status].join(' ')} p-3 text-center">
		{#if status == "loading"}
			<span>building index... check back in 1-5 minutes.</span>
		{:else if status == "indexing_error"}
			<span>there was an error while indexing! please notify me.</span>
		{:else if status == "api_error"}
			<span>api is down! please notify me.</span>
		{/if}
	</div>
{/if}
