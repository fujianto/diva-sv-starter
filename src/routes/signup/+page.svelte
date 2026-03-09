<script lang="ts">
	import type { PageProps } from "./$types"
	import SignupForm from "$lib/components/signup-form.svelte"

	let { data, form }: PageProps = $props()
</script>

<div class="flex h-screen w-full items-center justify-center px-4">
	<SignupForm {data} {form} />
</div>
