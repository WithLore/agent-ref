<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>AgentRef</title>
	<meta name="description" content="Collaborative reference board for humans and AI agents" />
</svelte:head>

{@render children()}
