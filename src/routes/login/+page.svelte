<script lang="ts">
	import type { PageProps } from './$types'
	let { data, form }: PageProps = $props()

	import LoginForm from '$lib/components/login-form.svelte'
</script>

<div class="flex h-screen w-full items-center justify-center px-4">
	<LoginForm {data} {form} />
</div>
