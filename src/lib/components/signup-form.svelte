<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js"
	import * as Card from "$lib/components/ui/card/index.js"
	import { Input } from "$lib/components/ui/input/index.js"
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
	} from "$lib/components/ui/field/index.js"
	import { enhance } from "$app/forms"
	import type { SubmitFunction } from "@sveltejs/kit"

	type SignupFormData = {
		success?: boolean
		errors?: {
			fieldErrors?: Record<string, string[]>
			formErrors?: string[]
		}
	}

	type Props = {
		data?: unknown
		form?: SignupFormData | null
	}

	const id = $props.id()
	const { form }: Props = $props()
	let formDataRes = $state<SignupFormData | null>(null)
	let isSignupSuccess = $state(false)

	$effect(() => {
		formDataRes = form ? form : null
		isSignupSuccess = Boolean(formDataRes?.success)
	})

	const signupFormEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update()
			formDataRes = (result as { data?: SignupFormData })?.data ?? null
			isSignupSuccess = Boolean(formDataRes?.success)
		}
	}
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Sign up</Card.Title>
		<Card.Description>Create a new account</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if isSignupSuccess}
			<div class="rounded-lg bg-green-100 p-4 text-sm text-green-800" role="status">
				Sign up success, You can login here:
				<a class="font-medium underline" href="/login">Login</a>
			</div>
		{:else}
			{#if formDataRes?.errors}
				{#if formDataRes?.errors?.fieldErrors?.username}
					<div class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700" role="alert">
						{formDataRes?.errors.fieldErrors.username}
					</div>
				{/if}

				{#if formDataRes?.errors?.fieldErrors?.email}
					<div class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700" role="alert">
						{formDataRes?.errors.fieldErrors.email}
					</div>
				{/if}

				{#if formDataRes?.errors?.fieldErrors?.password}
					<div class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700" role="alert">
						{formDataRes?.errors.fieldErrors.password}
					</div>
				{/if}

				{#if formDataRes?.errors?.fieldErrors?.confirmPassword}
					<div class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700" role="alert">
						{formDataRes?.errors.fieldErrors.confirmPassword}
					</div>
				{/if}

				{#if (formDataRes?.errors?.formErrors ?? []).length > 0}
					<div class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700" role="alert">
						{(formDataRes?.errors?.formErrors ?? []).join(", ")}
					</div>
				{/if}
			{/if}

			<form method="POST" action="?/doSignup" use:enhance={signupFormEnhance}>
				<FieldGroup>
					<Field>
						<FieldLabel for="username-{id}">Username</FieldLabel>
						<Input id="username-{id}" type="text" name="username" placeholder="Username" required />
					</Field>
					<Field>
						<FieldLabel for="email-{id}">Email</FieldLabel>
						<Input id="email-{id}" type="email" name="email" placeholder="m@example.com" required />
					</Field>
					<Field>
						<FieldLabel for="password-{id}">Password</FieldLabel>
						<Input id="password-{id}" type="password" name="password" required />
						<FieldDescription>Must be at least 8 characters long.</FieldDescription>
					</Field>
					<Field>
						<FieldLabel for="confirm-password-{id}">Confirm Password</FieldLabel>
						<Input id="confirm-password-{id}" type="password" name="confirmPassword" required />
					</Field>
					<Field>
						<Button type="submit" class="w-full">Create Account</Button>
						<FieldDescription class="text-center">
							Already have an account? <a href="/login">Login</a>
						</FieldDescription>
					</Field>
				</FieldGroup>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
