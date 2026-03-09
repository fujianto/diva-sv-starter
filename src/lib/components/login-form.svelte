<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js'
	import * as Card from '$lib/components/ui/card/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
	} from '$lib/components/ui/field/index.js'
	import { enhance } from '$app/forms'
	import type { FormEnhance, ResultEnhance } from '$lib/types/form.type'
	import { goto } from '$app/navigation'

	const id = $props.id()
	const { data, form } = $props()
	let formDataRes = $state<any>(null)

	$effect(() => {
		formDataRes = form ? form : null
	})

	const loginFormEnhance = ({
		formElement,
		formData,
		action,
		cancel,
		submitter,
	}: FormEnhance) => {
		return async ({ result, update }: ResultEnhance) => {
			formDataRes = result?.data ? result?.data : null
			console.log('Login form result ', JSON.stringify(formDataRes))
			if (formDataRes?.success) {
				console.log('Login successful, redirecting to dashboard')
				await goto('/dashboard')
				// window.location.href = '/dashboard'
			}
		}
	}
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description
			>Enter your email below to login to your account</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if formDataRes?.errors}
			{#if formDataRes?.errors?.fieldErrors?.username}
				<div
					class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700"
					role="alert">
					{formDataRes?.errors.fieldErrors.username}
				</div>
			{/if}

			{#if formDataRes?.errors?.fieldErrors?.password}
				<div
					class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700"
					role="alert">
					{formDataRes?.errors?.fieldErrors.password}
				</div>
			{/if}

			{#if formDataRes?.errors?.formErrors?.length > 0}
				<div
					class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700"
					role="alert">
					{formDataRes?.errors?.formErrors.join(', ')}
				</div>
			{/if}
		{/if}

		<form method="POST" action="?/doLogin" use:enhance={loginFormEnhance}>
			<FieldGroup>
				<Field>
					<FieldLabel for="username-{id}">Username</FieldLabel>
					<Input
						id="username-{id}"
						type="text"
						name="username"
						placeholder="Username or email"
						required />
				</Field>
				<Field>
					<div class="flex items-center">
						<FieldLabel for="password-{id}">Password</FieldLabel>
						<a
							href="##"
							class="ms-auto inline-block text-sm underline">
							Forgot your password?
						</a>
					</div>
					<Input
						id="password-{id}"
						type="password"
						name="password"
						required />
				</Field>
				<Field>
					<Button type="submit" class="w-full">Login</Button>
					<Button variant="outline" class="w-full">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24">
							<path
								d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
								fill="currentColor" />
						</svg>
						Login with Google
					</Button>
					<FieldDescription class="text-center">
						Don't have an account? <a href="##">Sign up</a>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	</Card.Content>
</Card.Root>
